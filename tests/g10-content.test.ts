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
