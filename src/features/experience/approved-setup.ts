import type {EventRepository} from '../../infrastructure/db/event-repository';
import {createEvent} from '../../domain/event/transition';
import type {EventRecord} from '../../domain/event/schemas';
import {ContentRepository} from '../../content/repository';
import {sha256} from '../../content/migration';
import {selectReviewedPack,type ContentItem} from '../../content/contracts';
import {createSession as rqSession} from '../../games/rundenquiz/engine';
import {createSession as qtSession} from '../../games/quiztafel/engine';
import {createSession as vbSession} from '../../games/verbindungen/engine';
import {createSession as llSession} from '../../games/logikleiter/engine';
import {createSession as udSession} from '../../games/umfrageduell/engine';
import type {SetupDraft,HostIdentity} from './model';

export async function createPreparedApproved(
 repo:EventRepository,draft:Pick<SetupDraft,'teams'|'count'|'profile'|'game'>,
):Promise<HostIdentity>{
 const store=new ContentRepository();
 let items:ContentItem[];
 try{items=await store.list();}finally{await store.close();}
 const eventId=crypto.randomUUID(),hostId=crypto.randomUUID();
 const teams=draft.teams.slice(0,draft.count).map((name,i)=>({
  id:draft.game.slice(0,2)+'-team-'+(i+1),order:i,name:name.trim(),colorToken:'team-'+(i+1),
 }));
 const roster=teams.map(({id,name,order})=>({id,name,order}));
 const freeze=(taskId:string,gameType:EventRecord['frozenTasks'][number]['gameType'],
  prompt:string,clues:string[],answers:string[],notes:string):EventRecord['frozenTasks'][number]=>{
  const source=items.find(i=>i.id===taskId&&i.game===gameType&&i.status==='approved');
  if(!source?.review)throw Error('Keine aktuell redaktionell freigegebene Aufgabe: '+taskId);
  return {taskId,gameType,publicPrompt:prompt,publicClues:clues,privateAnswers:answers,
   moderatorNotes:notes,sourceContentId:source.id,sourceHash:source.review.fingerprint};
 };
 const create=async(engine:Pick<EventRecord,'rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell'>,
  frozenTasks:EventRecord['frozenTasks'])=>{
  const missing=frozenTasks.filter(t=>!items.some(i=>i.id===t.sourceContentId));
  if(missing.length)throw Error('Nicht nachverfolgbare Inhalte');
  for(const task of frozenTasks){
   const source=items.find(i=>i.id===task.sourceContentId)!;
   const hash=await sha256(JSON.stringify(source.payload));
   if(source.status!=='approved'||hash!==task.sourceHash)
    throw Error('Inhalt wurde seit der Freigabe geändert: '+task.sourceContentId);
  }
  const event=createEvent({id:eventId,hostId,at:Date.now(),teams,
   program:[{id:'approved-'+draft.game+'-game',type:draft.game,profile:draft.profile,
    order:0,rulesVersion:draft.game+'-reviewed-v1'}],
   frozenTasks,...engine});
  await repo.create(event);
  return {eventId,hostId};
 };
 const fail=(e:unknown):never=>{
  throw Error('Freigegebener Bestand für '+draft.game+' / '+draft.profile+' / '+draft.count+
   ' Teams nicht vollständig oder ungültig. Kein Rückfall auf Probeinhalte. '+(e instanceof Error?e.message:String(e)));
 };
 try{
  switch(draft.game){
   case 'rundenquiz':{
    const bank=selectReviewedPack(items,'rundenquiz',draft.profile,draft.count);
    const rq=rqSession({id:eventId,ownerId:hostId,profile:draft.profile,teams:roster,bank});
    const frozen=rq.questions.map(q=>freeze(q.id,'rundenquiz',q.prompt,[...(q.clues??[])],[q.answer],q.reference));
    return await create({rundenquiz:rq},frozen);
   }
   case 'quiztafel':{
    const board=selectReviewedPack(items,'quiztafel',draft.profile,draft.count);
    const qt=qtSession({id:eventId,ownerId:hostId,profile:draft.profile,teams:roster,...board});
    const frozen=qt.tiles.map(t=>freeze(t.id,'quiztafel',t.prompt,[],[t.answer],t.reference));
    return await create({quiztafel:qt},frozen);
   }
   case 'verbindungen':{
    const puzzles=selectReviewedPack(items,'verbindungen',draft.profile,draft.count);
    const vb=vbSession({id:eventId,ownerId:hostId,profile:draft.profile,teams:roster,puzzles});
    const frozen=puzzles.map(p=>freeze(p.id,'verbindungen',
     p.kind==='clues'?'Vier Hinweise':p.kind==='sequence'?p.prompt:'Verbindungswand',
     p.kind==='clues'?[...p.clues]:[],p.kind==='clues'?[p.target]:
      p.kind==='sequence'?[p.answer]:p.groups.map(g=>g.link+' / '+g.tileIds.join(', ')),p.reference));
    return await create({verbindungen:vb},frozen);
   }
   case 'logikleiter':{
    const rungs=selectReviewedPack(items,'logikleiter',draft.profile,draft.count);
    const ll=llSession({id:eventId,ownerId:hostId,profile:draft.profile,teams:roster,rungs});
    const frozen=rungs.map(r=>freeze(r.id,'logikleiter',r.prompt,[r.hint],[r.answer],r.explanation+' / '+r.reference));
    return await create({logikleiter:ll},frozen);
   }
   case 'umfrageduell':{
    const surveys=selectReviewedPack(items,'umfrageduell',draft.profile,draft.count);
    const ud=udSession({id:eventId,ownerId:hostId,profile:draft.profile,teams:roster,surveys});
    const frozen=surveys.map(q=>freeze(q.id,'umfrageduell',q.prompt,[],q.categories.map(c=>c.label),
      q.source.kind==='illustrative'?'Beispieldaten – keine echten Befragungen':'Datenquelle: '+q.source.source));
    return await create({umfrageduell:ud},frozen);
   }
  }
 }catch(e){return fail(e);}
}
