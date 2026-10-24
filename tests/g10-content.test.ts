import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {createDraft,validatePayload,validateItem,findDuplicates,coverage,selectReviewedPack,
 type ContentItem} from '../src/content/contracts';
import {ContentRepository} from '../src/content/repository';
import {sha256,previewFile,legacyBackup,exportLibrary} from '../src/content/migration';
import {RQ_TRIAL_BANK} from '../src/games/rundenquiz/trial-bank';
import {trialLogikleiter} from '../src/games/logikleiter/trial-bank';
import {trialUmfrageduell} from '../src/games/umfrageduell/trial-bank';
import {trialVerbindungen} from '../src/games/verbindungen/trial-bank';
import {sampleQuiztafel} from '../src/games/quiztafel/trial-bank';
import type {GameType} from '../src/domain/game/contracts';
import {trialDraftBundle,trialDraftItems} from '../src/content/trial-draft-bundle';
import {contentReviewTasks,originalSourceLead,historicalTrialCorrection,draftSourceCitation} from '../src/content/editorial-source-review';
import {exportReviewWorksheet,worksheetCell,previewReviewWorksheet} from '../src/content/editorial-worklist';

const teams=Array.from({length:5},(_,i)=>({id:'team-'+i,name:'Team '+(i+1),order:i}));
const item=(game:GameType,payload:unknown):ContentItem=>createDraft(game,payload,123);
const approval=(d:ContentItem):ContentItem=>validateItem({...d,status:'approved',
 review:{reviewer:'Redaktion',checkedAt:123,note:'Inhalt und Quelle fachlich geprüft',
  fingerprint:'a'.repeat(64),checklist:[true,true,true,true]}});
const sample=(game:GameType)=>{
 switch(game){
  case 'rundenquiz':return RQ_TRIAL_BANK[0]!;
  case 'quiztafel':{
   const board=sampleQuiztafel('kurz',teams.slice(0,3)),tile=board.tiles[0]!;
   return {...tile,categoryName:board.categories.find(c=>c.id===tile.categoryId)!.name};
  }
  case 'verbindungen':return trialVerbindungen('kurz',teams.slice(0,3))[0]!;
  case 'logikleiter':return trialLogikleiter('kurz')[0]!;
  case 'umfrageduell':return trialUmfrageduell('kurz')[0]!;
 }
};
describe('G10 content contracts and rule authority',()=>{
 for(const game of ['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const)
  it('accepts correctly typed '+game+' candidate only as an unapproved draft',()=>{
   const example=item(game,sample(game));
   expect(example.status).toBe('draft');
   expect(validatePayload(game,example.payload)).toEqual([]);
   expect(()=>validateItem({...example,status:'approved'})).toThrow(/Freigabe/);
  });
 it('rejects missing source, answer and underdetermined logic references',()=>{
  const q=sample('rundenquiz') as {id:string;reference:string;answer:string};
  expect(validatePayload('rundenquiz',{...q,reference:''}).length).toBeGreaterThan(0);
  const logic=sample('logikleiter') as {hint:string;answer:string};
  expect(validatePayload('logikleiter',{...logic,hint:logic.answer}).length).toBeGreaterThan(0);
 });
 it('detects duplicate prompts and survey synonym collisions',()=>{
  const a=item('rundenquiz',sample('rundenquiz'));
  const b=item('rundenquiz',{...a.payload as object,id:'rq-other'});
  expect(findDuplicates([a,b])).toEqual([{id:'rq-other',other:a.id}]);
  const survey=structuredClone(sample('umfrageduell')) as {categories:{label:string;synonyms:string[]}[]};
  survey.categories[1]!.synonyms.push(survey.categories[0]!.label);
  expect(validatePayload('umfrageduell',survey).length).toBeGreaterThan(0);
 });
 it('qualifies full reviewed ladder and refuses incomplete profiles',()=>{
  const rungs=trialLogikleiter('lang').map(x=>approval(item('logikleiter',x)));
  for(const n of [3,4,5]){
   expect(coverage(rungs,'logikleiter','lang',n).ready).toBe(true);
   expect(selectReviewedPack(rungs,'logikleiter','lang',n)).toHaveLength(7);
  }
  expect(coverage(rungs.slice(0,4),'logikleiter','lang',3).ready).toBe(false);
  expect(()=>selectReviewedPack(rungs.slice(0,4),'logikleiter','lang',3)).toThrow();
 });
 it('rejects nonreviewed content in every game selector',()=>{
  for(const game of ['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const){
   const candidate=item(game,sample(game));
   expect(coverage([candidate],game,'kurz',3).totalApproved).toBe(0);
   expect(()=>{switch(game){
    case 'rundenquiz':selectReviewedPack([candidate],'rundenquiz','kurz',3);break;
    case 'quiztafel':selectReviewedPack([candidate],'quiztafel','kurz',3);break;
    case 'verbindungen':selectReviewedPack([candidate],'verbindungen','kurz',3);break;
    case 'logikleiter':selectReviewedPack([candidate],'logikleiter','kurz',3);break;
    case 'umfrageduell':selectReviewedPack([candidate],'umfrageduell','kurz',3);break;
   }}).toThrow();
  }
 });
 it('qualifies actual five-game pool structures for a 3-team Kurz event',()=>{
  const rq=RQ_TRIAL_BANK.map(x=>approval(item('rundenquiz',x)));
  const qt=sampleQuiztafel('kurz',teams.slice(0,3));
  const tiles=qt.tiles.map(t=>approval(item('quiztafel',{
   ...t,categoryName:qt.categories.find(c=>c.id===t.categoryId)!.name,
  })));
  const vb=trialVerbindungen('kurz',teams.slice(0,3)).map(x=>approval(item('verbindungen',x)));
  const ll=trialLogikleiter('kurz').map(x=>approval(item('logikleiter',x)));
  const ud=trialUmfrageduell('kurz').map(x=>approval(item('umfrageduell',x)));
  expect(selectReviewedPack(rq,'rundenquiz','kurz',3).length).toBe(7);
  expect(selectReviewedPack(tiles,'quiztafel','kurz',3).tiles.length).toBe(9);
  expect(selectReviewedPack(vb,'verbindungen','kurz',3).length).toBe(4);
  expect(selectReviewedPack(ll,'logikleiter','kurz',3).length).toBe(3);
  expect(selectReviewedPack(ud,'umfrageduell','kurz',3).length).toBe(4);
 });
});
describe('G10 read-only migration',()=>{
 it('exports every and only legacy-prefixed browser key without writes',async()=>{
  const keys=['other.secret','ligo.quiz.session.a','ligo.quiz.content.library.v1',
   'ligo.quiz.unknown.future','ligoquiz.v2.preferences.v1'];
  const data=new Map(keys.map((key,i)=>[key,'value-'+i]));
  let writes=0;
  const storage={length:keys.length,key:(i:number)=>keys[i]??null,
   getItem:(k:string)=>data.get(k)??null,setItem:()=>{writes++;}};
  const archive=await legacyBackup(storage,'https://thiepn.github.io');
  expect(archive.rawEntries.map(x=>x.key)).toEqual([
   'ligo.quiz.content.library.v1','ligo.quiz.session.a','ligo.quiz.unknown.future',
  ]);
  expect(archive.checksum).toBe(await sha256(JSON.stringify(archive.rawEntries)));
  expect(writes).toBe(0);
 });
 it('rejects modified legacy bundle checksums and invalid JSON',async()=>{
  const backup=await legacyBackup({length:1,key:()=> 'ligo.quiz.content.library.v1',getItem:()=>'{garbled'},
   'https://legacy.example');
  const malformed={...backup,checksum:'f'.repeat(64)};
  await expect(previewFile(JSON.stringify(malformed))).rejects.toThrow(/Prüfsumme/);
  await expect(previewFile('{')).rejects.toThrow(/JSON/);
 });
 it('preserves every legacy entry as either draft or quarantine, never auto-approves',async()=>{
  const data={format:'ligo-content-pack',items:[
   {id:'old-1',game:'rundenquiz',payload:sample('rundenquiz'),status:'approved'},
   {id:'unknown',game:'unmapped-mode',data:{question:'xyz'}},
   {id:'broken',game:'rundenquiz',payload:{id:'broken',prompt:'Missing answer'}},
  ]};
  const preview=await previewFile(JSON.stringify(data));
  expect(preview.items).toHaveLength(1);
  expect(preview.quarantined).toHaveLength(2);
  expect(preview.items[0]?.status).toBe('draft');
  expect(preview.items[0]?.provenance.sourceId).toBe('old-1');
  expect(preview.items.length+preview.quarantined.length).toBe(preview.records);
 });
 it('v2 exported approved records revert to review-required drafts',async()=>{
  const approved=approval(item('logikleiter',sample('logikleiter')));
  const preview=await previewFile(exportLibrary([approved]));
  expect(preview.items[0]?.status).toBe('draft');
  expect(preview.items[0]?.review).toBeUndefined();
 });
});
describe('G10 dedicated transactional content store',()=>{
 it('enforces content review, revision fencing and hash-matched publish',async()=>{
  const db=new ContentRepository(fakeIndexedDB,'g10-review-'+crypto.randomUUID());
  try{
   const draft=item('rundenquiz',sample('rundenquiz'));
   await db.create(draft);
   await expect(db.create(draft)).rejects.toMatchObject({code:'CONFLICT'});
   const review=await db.sendToReview(draft);
   await expect(db.approve(review,{reviewer:'X',note:'short',checklist:[true,true,true,true]})).rejects.toThrow();
   const approved=await db.approve(review,{reviewer:'Redaktion',note:'Fakten und Quellen sind kontrolliert',checklist:[true,true,true,true]});
   expect(approved.status).toBe('approved');
   expect(approved.review?.fingerprint).toBe(await sha256(JSON.stringify(approved.payload)));
   await expect(db.saveDraft(draft)).rejects.toMatchObject({code:'CONFLICT'});
   const edited=await db.saveDraft({...approved,payload:{...approved.payload as object,prompt:'Neu geprüft?'}});
   expect(edited.status).toBe('draft');
   expect(edited.review).toBeUndefined();
   expect((await db.list())[0]?.status).toBe('draft');
  }finally{await db.close();}
 });
 it('commits an import with quarantines atomically, retries idempotently and undoes untouched drafts',async()=>{
  const db=new ContentRepository(fakeIndexedDB,'g10-import-'+crypto.randomUUID());
  try{
   const bundle=JSON.stringify({format:'ligo-content-pack',items:[
    {id:'old-1',game:'logikleiter',payload:sample('logikleiter')},
    {id:'unmapped',game:'unknown',payload:{}},
   ]});
   const preview=await previewFile(bundle);
   await expect(db.importPreview(preview,false)).rejects.toMatchObject({code:'UNSAFE'});
   expect(await db.importPreview(preview,true)).toBe('created');
   expect(await db.importPreview(preview,true)).toBe('already-imported');
   expect(await db.list()).toHaveLength(1);
   expect(await db.quarantined()).toHaveLength(1);
   expect(await db.receipts()).toHaveLength(1);
   await db.undo(preview.bundleHash);
   expect(await db.list()).toHaveLength(0);
   expect(await db.quarantined()).toHaveLength(0);
  }finally{await db.close();}
 });
 it('refuses import undo after editorial change and does not erase it',async()=>{
  const db=new ContentRepository(fakeIndexedDB,'g10-undo-'+crypto.randomUUID());
  try{
   const preview=await previewFile(JSON.stringify({format:'ligo-content-pack',
    items:[{id:'old-1',game:'rundenquiz',payload:sample('rundenquiz')}]}));
   await db.importPreview(preview,true);
   const original=(await db.list())[0]!;
   await db.saveDraft(original);
   await expect(db.undo(preview.bundleHash)).rejects.toMatchObject({code:'UNSAFE'});
   expect(await db.list()).toHaveLength(1);
   expect(await db.receipts()).toHaveLength(1);
  }finally{await db.close();}
 });
});

describe('Five existing trial banks enter editorial storage only as unapproved drafts',()=>{
 it('produces a deterministic, source-traceable typed source for 79 original trial tasks',()=>{
  const all=trialDraftItems();
  expect(all).toHaveLength(79);
  expect(new Set(all.map(x=>x.id)).size).toBe(79);
  expect(Object.fromEntries(['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell']
   .map(g=>[g,all.filter(x=>x.game===g).length]))).toEqual({
    rundenquiz:16,quiztafel:30,verbindungen:16,logikleiter:7,umfrageduell:10});
  expect(all.every(x=>x.status==='draft'&&x.revision===0&&!x.review&&
   !x.provenance.rights&&x.provenance.origin==='sample'&&
   x.provenance.sourceKey?.startsWith('src/games/')&&validatePayload(x.game,x.payload).length===0)).toBe(true);
  expect(trialDraftBundle()).toBe(trialDraftBundle());
 });
 it('uses original G10 preview, consent, receipt, collision quarantine and safe undo',async()=>{
  const bytes=trialDraftBundle(),p=await previewFile(bytes);
  expect([p.items.length,p.quarantined.length,p.records]).toEqual([79,0,79]);
  const db=new ContentRepository(fakeIndexedDB,'five-mode-trials-'+crypto.randomUUID());
  try{
   await expect(db.importPreview(p,false)).rejects.toMatchObject({code:'UNSAFE'});
   expect(await db.list()).toHaveLength(0);
   expect(await db.importPreview(p,true)).toBe('created');
   const stored=await db.list();
   expect(stored).toHaveLength(79);
   expect(stored.every(x=>x.status==='draft'&&!x.review&&!x.provenance.rights)).toBe(true);
   const again=await previewFile(bytes,stored);
   expect([again.items.length,again.quarantined.length]).toEqual([0,79]);
   expect(again.bundleHash).toBe(p.bundleHash);
   expect(await db.importPreview(again,true)).toBe('already-imported');
   expect(await db.list()).toHaveLength(79);
   await db.undo(p.bundleHash);
   expect(await db.list()).toHaveLength(0);
  }finally{await db.close();}
 });
 it('covers original long five-team engine structures, without persisting synthetic approvals',()=>{
  const synthetic=trialDraftItems().map(x=>validateItem({...x,status:'approved',review:{
   reviewer:'Fictitious test only',checkedAt:0,
   note:'Nonpersistent fixture for checking five engine structures',
   fingerprint:'f'.repeat(64),checklist:[true,true,true,true]}}));
  for(const game of ['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const){
   expect(coverage(synthetic,game,'lang',5).ready,game).toBe(true);
   switch(game){
    case 'rundenquiz':expect(selectReviewedPack(synthetic,game,'lang',5)).toHaveLength(16);break;
    case 'quiztafel':expect(selectReviewedPack(synthetic,game,'lang',5).tiles).toHaveLength(30);break;
    case 'verbindungen':expect(selectReviewedPack(synthetic,game,'lang',5)).toHaveLength(16);break;
    case 'logikleiter':expect(selectReviewedPack(synthetic,game,'lang',5)).toHaveLength(7);break;
    case 'umfrageduell':expect(selectReviewedPack(synthetic,game,'lang',5)).toHaveLength(10);break;
   }
  }
  expect(trialDraftItems().every(x=>x.status==='draft')).toBe(true);
 });
});

describe('Source leads are review work, never content approvals',()=>{
 it('routes 79 trial questions to 12 exact-match primary leads, 10 illustrative and 57 other checks',()=>{
  const records=trialDraftItems(),queue=contentReviewTasks(records);
  expect(queue).toHaveLength(79);
  expect(queue.filter(x=>x.route==='primary').map(x=>x.item.id))
   .toEqual(['qt-geschichte-2','qt-geschichte-3','qt-geschichte-4','qt-geschichte-5',
    'qt-natur-1','qt-natur-2','qt-natur-5','qt-natur-6','rq-s1','rq-s4','rq-w4','rq-w6']);
  expect(queue.filter(x=>x.route==='illustrative')).toHaveLength(10);
  expect(queue.filter(x=>x.route==='lookup')).toHaveLength(57);
  for(const task of queue.filter(x=>x.route==='primary')){
   expect(task.lead?.url).toMatch(/^https:\/\/(www\.)?(ris\.bka\.gv\.at|science\.nasa\.gov|bipm\.org|worldathletics\.org|whc\.unesco\.org|guides\.loc\.gov|list\.iupac\.org|www\.bundesregierung\.de|www\.bundeskanzler\.de)\//);
   expect(task.item.status).toBe('draft');
   expect(task.item.review).toBeUndefined();
   expect(task.item.provenance.rights).toBeUndefined();
   expect(task.issues.some(x=>x.code==='RIGHTS_NOT_DOCUMENTED')).toBe(true);
  }
 });
 it('preserves the four unchanged primary leads for previously imported v1 Rundenquiz drafts',()=>{
  for(const id of ['rq-w4','rq-w6','rq-s1','rq-s4']){
   const latest=trialDraftItems().find(item=>item.id===id)!;
   const prior=validateItem({...latest,provenance:{...latest.provenance,
    sourceVersion:'v2-original-trial-banks-v1'}});
   expect(originalSourceLead(prior)?.url).toBe(originalSourceLead(latest)?.url);
   expect(prior.status).toBe('draft');
   expect(prior.review).toBeUndefined();
  }
  const olderHistory=trialDraftItems().find(item=>item.id==='qt-geschichte-4')!;
  expect(originalSourceLead({...olderHistory,provenance:{...olderHistory.provenance,
   sourceVersion:'v2-original-trial-banks-v1'}})).toBeNull();
 });
 it('invalidates the linked source after edits, changed ID or replaced provenance',()=>{
  const base=trialDraftItems().find(x=>x.id==='rq-w4')!;
  expect(originalSourceLead(base)?.name).toContain('Bundes-Verfassungsgesetz');
  expect(originalSourceLead({...base,payload:{...base.payload as object,answer:'Salzburg'}})).toBeNull();
  expect(originalSourceLead({...base,provenance:{...base.provenance,origin:'legacy'}})).toBeNull();
  expect(originalSourceLead({...base,provenance:{...base.provenance,sourceVersion:'different'}})).toBeNull();
  expect(originalSourceLead({...base,id:'rq-w6'})).toBeNull();
  const task=contentReviewTasks([{...base,payload:{...base.payload as object,answer:'Salzburg'}}]);
  expect(task[0]?.route).toBe('lookup');
  expect(task[0]?.lead).toBeNull();
 });
 it('does not mutate content or pretend survey observations and external approval',()=>{
  const items=trialDraftItems(),before=JSON.stringify(items),tasks=contentReviewTasks(items);
  expect(JSON.stringify(items)).toBe(before);
  expect(tasks.every(x=>!Object.hasOwn(x,'approved')&&!Object.hasOwn(x,'verified'))).toBe(true);
  expect(tasks.filter(x=>x.route==='illustrative').every(x=>
   (x.item.payload as {source?:{kind?:string}}).source?.kind==='illustrative')).toBe(true);
 });
});

describe('Two original Quiztafel ambiguity repairs retain IDs without granting rights or approval',()=>{
 it('specifies Pompeii with its forum and amphitheatre and dates Byzantium through 1453',()=>{
  const q4=trialDraftItems().find(x=>x.id==='qt-geschichte-4')!;
  const q5=trialDraftItems().find(x=>x.id==='qt-geschichte-5')!;
  const p4=q4.payload as {prompt:string;answer:string;reference:string};
  const p5=q5.payload as {prompt:string;answer:string;reference:string};
  expect(p4.prompt).toMatch(/Forum und ein Amphitheater/);
  expect(p4.reference).toContain('whc.unesco.org/en/list/829');
  expect(p4.answer).toBe('Pompeji');
  expect(p5.prompt).toMatch(/Mittelalters.*1453/);
  expect(p5.reference).toContain('guides.loc.gov/byzantine-empire/introduction');
  expect(p5.answer).toBe('Das Byzantinische Reich');
  expect(q4.status).toBe('draft');
  expect(q5.status).toBe('draft');
  expect(q4.provenance.sourceVersion).toBe('v2-original-trial-banks-v2');
  expect(q4.review).toBeUndefined();
 });
 it('offers stale imported V1 sample repairs only for exact unchanged matching records',()=>{
  for(const [id,oldPrompt,oldRef] of [
   ['qt-geschichte-4','Welche Stadt wurde im Jahr 79 beim Ausbruch des Vesuvs verschüttet?',
    'UNESCO: Archaeological Areas of Pompei'],
   ['qt-geschichte-5','Welches antike Reich hatte Konstantinopel als Hauptstadt?',
    'Encyclopaedia Britannica: Byzantine Empire'],
  ] as const){
   const current=trialDraftItems().find(x=>x.id===id)!;
   const old=validateItem({...current,payload:{...current.payload as object,prompt:oldPrompt,
    reference:oldRef},provenance:{...current.provenance,sourceVersion:'v2-original-trial-banks-v1'}});
   const c=historicalTrialCorrection(old);
   expect(c?.prompt).not.toBe(oldPrompt);
   expect(c?.url).toMatch(/^https:\/\//);
   expect(historicalTrialCorrection({...old,payload:{...old.payload as object,answer:'Other'}})).toBeNull();
   expect(historicalTrialCorrection({...old,provenance:{...old.provenance,sourceVersion:'different'}})).toBeNull();
   expect(historicalTrialCorrection(current)).toBeNull();
  }
 });
});

describe('Editorial queue keeps duplicated clue targets visible without content authority',()=>{
 it('lists three cross-game targets, with reciprocal direct-link IDs and no approval',()=>{
  const tasks=contentReviewTasks(trialDraftItems());
  const flagged=tasks.filter(x=>x.issues.some(issue=>issue.code==='CROSS_GAME_CLUE_REUSE'));
  expect(flagged).toHaveLength(6);
  expect(flagged.map(t=>t.item.id)).toEqual([
   'rq-h1','rq-h2','rq-h3','vb-a-david','vb-a-ester','vb-a-petrus',
  ]);
  expect(flagged.every(t=>t.issues.some(i=>i.other&&tasks.some(other=>other.item.id===i.other)))).toBe(true);
  expect(flagged.every(t=>t.item.status==='draft'&&!t.item.review)).toBe(true);
 });
});

describe('Explicit local editorial worksheet exports actual source-bound draft work',()=>{
 it('covers all 79 originals without converting review hints to permission or approval',()=>{
  const items=trialDraftItems(),before=JSON.stringify(items);
  const csv=exportReviewWorksheet(contentReviewTasks(items));
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv.split('\r\n')).toHaveLength(81); // header, 79 originals, final terminator
  expect(csv).toContain('"rq-w4","rundenquiz","draft","primary"');
  expect(csv).toContain('"qt-geschichte-4","quiztafel","draft","primary"');
  expect(csv).toContain('https://whc.unesco.org/en/list/829/');
  expect(csv).toContain('https://science.nasa.gov/mercury/');
  expect(csv).toContain('"ud-01","umfrageduell","draft","illustrative"');
  expect(csv).toContain('Nur illustrativ, nicht erhoben');
  expect(csv).toContain('"rq-h1","rundenquiz","draft","lookup"');
  expect(csv).toContain('Ich besiegte Goliat.');
  expect(csv).toContain('Hinweise: Ich lebte in Bethlehem.');
  expect(csv).toContain('Brücken-und-Lampe-Problem');
  expect(csv).toContain('"vb-a-david"');
  expect(csv).toContain('"Redaktionelle Entscheidung"');
  expect(JSON.stringify(items)).toBe(before);
  expect(items.every(x=>x.status==='draft'&&!x.review&&!x.provenance.rights)).toBe(true);
 });
 it('respects supplied selected subset and neutralizes spreadsheet injection',()=>{
  const tasks=contentReviewTasks(trialDraftItems());
  const selected=tasks.filter(x=>x.item.id==='rq-h1');
  const csv=exportReviewWorksheet(selected);
  expect(csv.split('\r\n')).toHaveLength(3);
  expect(csv).toContain('"vb-a-david"');
  expect(csv).toContain('Ich besiegte Goliat.');
  expect(csv).not.toContain('"rq-w4"');
  expect(worksheetCell('=WEBSERVICE("https://evil.example")')).toBe(
   '"\'=WEBSERVICE(""https://evil.example"")"');
  expect(worksheetCell('  +CMD')).toBe('"\'  +CMD"');
  expect(worksheetCell('safe,"text"\nline')).toBe('"safe,""text""\nline"');
 });
});

describe('Staging source-backed citations in the original editorial draft engine',()=>{
 it('offers six additional exact-source proposals and leaves drafts, rights and reviews untouched',()=>{
  const originals=trialDraftItems(),snapshot=JSON.stringify(originals);
  const ids=['qt-natur-1','qt-natur-2','qt-natur-5','qt-natur-6','qt-geschichte-2','qt-geschichte-3'];
  for(const id of ids){
   const item=originals.find(x=>x.id===id)!;
   const proposed=draftSourceCitation(item);
   expect(proposed).toContain('https://');
   expect(proposed).toContain((item.payload as {reference:string}).reference);
   const changed={...item,payload:{...item.payload as object,reference:proposed}};
   expect(validatePayload(item.game,changed.payload)).toEqual([]);
   expect(originalSourceLead(changed)).toBeNull();
   expect(draftSourceCitation(changed)).toBeNull();
   expect(item.status).toBe('draft');
   expect(item.review).toBeUndefined();
   expect(item.provenance.rights).toBeUndefined();
  }
  expect(JSON.stringify(originals)).toBe(snapshot);
 });
 it('rejects changed payload, unauthorized origin, changed original source ID and already linked questions',()=>{
  const item=trialDraftItems().find(x=>x.id==='qt-natur-6')!;
  const citation=draftSourceCitation(item);
  expect(citation).toContain('list.iupac.org');
  expect(draftSourceCitation({...item,payload:{...item.payload as object,prompt:'Wrong question'}})).toBeNull();
  expect(draftSourceCitation({...item,provenance:{...item.provenance,origin:'legacy'}})).toBeNull();
  expect(draftSourceCitation({...item,provenance:{...item.provenance,sourceId:'wrong'}})).toBeNull();
  expect(draftSourceCitation({...item,payload:{...item.payload as object,reference:citation}})).toBeNull();
  expect(draftSourceCitation(trialDraftItems().find(x=>x.id==='qt-geschichte-4')!)).toBeNull();
 });
});

describe('Offline editor CSV reentry is read-only and bound to exact question content',()=>{
 const notesFor=(rows:string,needle:string,values:string[])=>
  rows.split('\r\n').map(line=>{
   if(!line.startsWith(needle))return line;
   return line.replace(/,"","","","",""$/,','+values.map(worksheetCell).join(','));
  }).join('\r\n');
 it('imports edited worksheet notes against matching source-bound questions, no rights or approvals',()=>{
  const originals=trialDraftItems(),tasks=contentReviewTasks(originals),before=JSON.stringify(originals);
  const text=notesFor(exportReviewWorksheet(tasks),'"rq-w4",',
   ['Wien geprüft','RIS Artikel nachschlagen','','','Nicht freigeben']);
  const output=previewReviewWorksheet(text,tasks);
  expect(output).toMatchObject({matched:1,changed:0,missing:0});
  expect(output.rows[0]).toMatchObject({id:'rq-w4',status:'current'});
  expect(output.rows[0]?.notes.map(n=>n.text)).toEqual([
   'Wien geprüft','RIS Artikel nachschlagen','Nicht freigeben',
  ]);
  expect(JSON.stringify(originals)).toBe(before);
  expect(originals.every(i=>i.status==='draft'&&!i.review&&!i.provenance.rights)).toBe(true);
 });
 it('rejects changed answers, missing source IDs and CSV identity tampering',()=>{
  const original=trialDraftItems().find(x=>x.id==='rq-w4')!,tasks=contentReviewTasks([original]);
  const text=notesFor(exportReviewWorksheet(tasks),'"rq-w4",',['','Neue Quelle','','','Prüfen']);
  const changed={...original,payload:{...original.payload as object,answer:'Andere Antwort'}};
  const stale=previewReviewWorksheet(text,contentReviewTasks([changed]));
  expect(stale).toMatchObject({matched:0,changed:1,missing:0});
  const missing=previewReviewWorksheet(text,[]);
  expect(missing).toMatchObject({matched:0,changed:0,missing:1});
  expect(()=>previewReviewWorksheet(text.replace('"rq-w4","rundenquiz"','"rq-w6","rundenquiz"'),tasks))
   .not.toThrow();
  expect(previewReviewWorksheet(text.replace('"rq-w4","rundenquiz"','"rq-w6","rundenquiz"'),tasks)
   .missing).toBe(1);
 });
 it('parses embedded CSV quotes and newlines, rejects invalid schemas, duplicate IDs and oversize input',()=>{
  const tasks=contentReviewTasks(trialDraftItems());
  const csv=notesFor(exportReviewWorksheet(tasks),'"rq-w4",',
   ['Quellentext "Art. 5"\nnoch prüfen','','','','']);
  expect(previewReviewWorksheet(csv,tasks).rows[0]?.notes[0]?.text)
   .toBe('Quellentext "Art. 5"\nnoch prüfen');
  expect(()=>previewReviewWorksheet('id,question\r\nfoo,bar',tasks)).toThrow();
  const first=csv.split('\r\n').find(x=>x.startsWith('"rq-w4",'))!;
  expect(()=>previewReviewWorksheet(csv+'\r\n'+first+'\r\n',tasks)).toThrow();
  expect(()=>previewReviewWorksheet('x'.repeat(1024*1024+1),tasks)).toThrow();
 });
});
