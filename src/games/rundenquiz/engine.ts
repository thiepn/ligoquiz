import {normalizeDecimal,compareAbsoluteError,type Decimal} from './decimal';
/** BP-03 Rundenquiz rules — deterministic, browser/React/database independent. */
export type Round='wissen'|'hinweise'|'schaetzen'|'finale';
export type Profile='kurz'|'standard'|'lang';
export type Judgement='richtig'|'falsch'|'keine';
export type Phase='setup'|'ready'|'open'|'closed'|'revealed'|'graded'|'complete';
export type Id=string;
export type Team={id:Id;name:string;order:number};
export type Question={id:Id;round:Round;prompt:string;answer:string;reference:string;choices?:readonly string[];clues?:readonly string[];truth?:number|Decimal;unit?:string;durationSeconds:number};
export type Entry={estimate?:Decimal|null;lockLevel?:number;judgement?:Judgement};
export type Award={teamId:Id;questionId:Id;points:number;judgement:Judgement;rank?:number};
export type Audit={revision:number;commandId:Id;action:string;issuedAt:number};
export type Session={
 id:Id;ownerId:Id;epoch:number;revision:number;profile:Profile;
 teams:readonly Team[];questions:readonly Question[];phase:Phase;paused:boolean;index:number;clueCount:number;
 entries:Readonly<Record<Id,Entry>>;awards:readonly Award[];audit:readonly Audit[];
};
export type Action=
 |{type:'START'}|{type:'PUBLISH'}|{type:'NEXT_CLUE'}|{type:'LOCK_HINT';teamId:Id}
 |{type:'ESTIMATE';teamId:Id;value:number|Decimal|null}|{type:'CLOSE'}|{type:'REVEAL'}
 |{type:'JUDGE';teamId:Id;value:Judgement}|{type:'CONFIRM'}|{type:'CORRECT'}
 |{type:'ANNUL'}|{type:'NEXT'}|{type:'FINISH'}|{type:'PAUSE'}|{type:'RESUME'};
export type Command={id:Id;ownerId:Id;epoch:number;expectedRevision:number;at:number;action:Action};
export class RuleError extends Error{constructor(readonly code:string,message:string){super(message);this.name='RuleError';}}
function ensure(test:unknown,code:string,message:string):asserts test{if(!test)throw new RuleError(code,message);}
export const PROFILE_COUNTS:Record<Profile,Record<Round,number>>={
 kurz:{wissen:3,hinweise:2,schaetzen:2,finale:0},
 standard:{wissen:4,hinweise:3,schaetzen:3,finale:1},
 lang:{wissen:6,hinweise:4,schaetzen:4,finale:2},
};
export const ROUNDS:readonly Round[]=['wissen','hinweise','schaetzen','finale'];
const ANSWERED:readonly Judgement[]=['richtig','falsch','keine'];
export function validateQuestion(q:Question):void{
 ensure(!!q.id.trim()&&!!q.prompt.trim()&&!!q.answer.trim(),'CONTENT','Frage hat kein vollständiges Textmaterial');
 ensure(!!q.reference.trim(),'CONTENT','Quellenangabe fehlt');
 ensure(Number.isInteger(q.durationSeconds)&&q.durationSeconds>=5&&q.durationSeconds<=300,'CONTENT','Zeitvorgabe ungültig');
 if(q.round==='hinweise')ensure(q.clues?.length===4&&q.clues.every(c=>!!c.trim()),'CONTENT','Hinweise erfordern genau vier Hinweise');
 if(q.round==='schaetzen'){
   ensure(q.truth!==undefined&&(typeof q.truth==='string'||Number.isSafeInteger(q.truth))&&!!q.unit?.trim(),'CONTENT','Schätzfrage benötigt exakte Dezimalzahl und Einheit');
   normalizeDecimal(q.truth!);
 }
}
export function selectProfile(bank:readonly Question[],profile:Profile):Question[]{
 const counts=PROFILE_COUNTS[profile],selected:Question[]=[];
 for(const round of ROUNDS){const pool=bank.filter(q=>q.round===round);
  ensure(pool.length>=counts[round],'CONTENT','Nicht genug Fragen: '+round);
  selected.push(...pool.slice(0,counts[round]));
 }
 ensure(new Set(selected.map(q=>q.id)).size===selected.length,'CONTENT','Fragen-IDs nicht eindeutig');
 selected.forEach(validateQuestion);return selected;
}
export function createSession(args:{id:Id;ownerId:Id;profile:Profile;teams:readonly Team[];bank:readonly Question[]}):Session{
 const {id,ownerId,profile,teams,bank}=args;
 ensure(!!id&&!!ownerId,'SETUP','Sitzungskennung fehlt');
 ensure(teams.length>=3&&teams.length<=5,'SETUP','3–5 Teams erforderlich');
 ensure(teams.every(t=>t.id&&t.name.trim()&&t.name.trim().length<=40),'SETUP','Teamname fehlt');
 ensure(new Set(teams.map(t=>t.id)).size===teams.length,'SETUP','Doppelte Team-ID');
 ensure(new Set(teams.map(t=>t.order)).size===teams.length,'SETUP','Doppelte Reihenfolge');
 ensure(new Set(teams.map(t=>t.name.trim().toLocaleLowerCase('de-DE'))).size===teams.length,'SETUP','Teamnamen sind doppelt');
 return {id,ownerId,epoch:1,revision:0,profile,teams:teams.map(t=>({...t,name:t.name.trim()})),
  questions:selectProfile(bank,profile),phase:'setup',paused:false,index:0,clueCount:0,entries:{},awards:[],audit:[]};
}
export function currentQuestion(s:Session):Question|null{return s.questions[s.index]??null;}
export function scores(s:Session):Record<Id,number>{
 const result:Record<Id,number>=Object.fromEntries(s.teams.map(t=>[t.id,0]));
 for(const a of s.awards){ensure(a.teamId in result,'CORRUPT','Unbekanntes Team');result[a.teamId]=(result[a.teamId]??0)+a.points;}
 return result;
}
export function estimateAwards(values:Readonly<Record<Id,Decimal|number|null>>,truth:Decimal|number):Record<Id,{rank:number;points:number}>{
 ensure(typeof truth==='string'||Number.isSafeInteger(truth),'VALUE','Wahrheit muss exakter Dezimalwert sein');
 const normalized=normalizeDecimal(truth);
 const valid=Object.entries(values).filter(([,v])=>v!==null).map(([teamId,value])=>{
  ensure(typeof value==='string'||Number.isSafeInteger(value),'VALUE','Schätzung muss exakte Dezimalzahl sein');
  return [teamId,normalizeDecimal(value!)] as const;
 });
 valid.sort((a,b)=>compareAbsoluteError(a[1],b[1],normalized)||a[0].localeCompare(b[0]));
 const pointScale=[15,12,9,6,3],r:Record<string,{rank:number;points:number}>={};
 let previous:Decimal|undefined,rank=1;
 valid.forEach(([teamId,estimate],i)=>{if(previous===undefined||compareAbsoluteError(estimate,previous,normalized)!==0)rank=i+1;
  r[teamId]={rank,points:pointScale[rank-1]??0};previous=estimate;});
 return r;
}
export function taskAwards(s:Session):Award[]{
 const q=currentQuestion(s);ensure(q,'PHASE','Keine aktive Aufgabe');
 ensure(s.phase==='revealed'||s.phase==='graded','PHASE','Lösung wurde noch nicht gezeigt');
 if(q.round==='schaetzen'){
  for(const t of s.teams)ensure(Object.hasOwn(s.entries,t.id)&&Object.hasOwn(s.entries[t.id]??{},'estimate'),'RESPONSE','Schätzung fehlt');
  const ranked=estimateAwards(Object.fromEntries(s.teams.map(t=>[t.id,s.entries[t.id]?.estimate??null])),q.truth!);
  return s.teams.map(t=>{const r=ranked[t.id];return {teamId:t.id,questionId:q.id,judgement:r?'richtig':'keine',points:r?.points??0,...(r?{rank:r.rank}:{})};});
 }
 return s.teams.map(t=>{const entry=s.entries[t.id];
  ensure(entry&&entry.judgement&&ANSWERED.includes(entry.judgement),'RESPONSE','Bewertung fehlt: '+t.name);
  ensure(q.round!=='hinweise'||entry.judgement!=='richtig'||entry.lockLevel,'RESPONSE','Hinweisantwort ohne Abgabe');
  const points=entry.judgement!=='richtig'?0:q.round==='wissen'?10:q.round==='finale'?20:25-5*entry.lockLevel!;
  return {teamId:t.id,questionId:q.id,points,judgement:entry.judgement};
 });
}
export function transition(s:Session,c:Command):Session{
 ensure(c.ownerId===s.ownerId&&c.epoch===s.epoch,'HOST','Falsche Spielleitung');
 ensure(c.expectedRevision===s.revision,'REVISION','Sitzung wurde geändert');
 ensure(!s.audit.some(a=>a.commandId===c.id),'REPLAY','Befehl bereits angewendet');
 const q=currentQuestion(s),a=c.action;
 const phase=(...allowed:Phase[])=>ensure(allowed.includes(s.phase),'PHASE','Aktion '+a.type+' hier nicht erlaubt');
 if(s.paused&&a.type!=='RESUME')throw new RuleError('PAUSED','Quizabend pausiert');
 let next:Session=s;
 switch(a.type){
 case 'START':phase('setup');next={...s,phase:'ready'};break;
 case 'PUBLISH':phase('ready');ensure(q,'PHASE','Keine nächste Aufgabe');
  next={...s,phase:'open',clueCount:q.round==='hinweise'?1:0,entries:{}};break;
 case 'NEXT_CLUE':phase('open');ensure(q?.round==='hinweise'&&s.clueCount<4,'PHASE','Keine Hinweise mehr');next={...s,clueCount:s.clueCount+1};break;
 case 'LOCK_HINT':phase('open');ensure(q?.round==='hinweise','PHASE','Nicht in Hinweisrunde');
  ensure(s.teams.some(t=>t.id===a.teamId),'TEAM','Team unbekannt');ensure(!Object.hasOwn(s.entries,a.teamId),'LOCK','Antwort schon abgegeben');
  next={...s,entries:{...s.entries,[a.teamId]:{lockLevel:s.clueCount}}};break;
 case 'ESTIMATE':phase('open');ensure(q?.round==='schaetzen','PHASE','Nicht in Schätzrunde');
  ensure(s.teams.some(t=>t.id===a.teamId),'TEAM','Team unbekannt');
  ensure(a.value===null||typeof a.value==='string'||Number.isSafeInteger(a.value),'VALUE','Ungültige Schätzung');
  next={...s,entries:{...s.entries,[a.teamId]:{estimate:a.value===null?null:normalizeDecimal(a.value)}}};break;
 case 'CLOSE':phase('open');
  if(q?.round==='schaetzen')ensure(s.teams.every(t=>Object.hasOwn(s.entries,t.id)&&Object.hasOwn(s.entries[t.id]??{},'estimate')),'RESPONSE','Schätzantwort fehlt');
  next={...s,phase:'closed'};break;
 case 'REVEAL':phase('closed');next={...s,phase:'revealed'};break;
 case 'JUDGE':phase('revealed');ensure(q?.round!=='schaetzen','PHASE','Schätzwerte automatisch');
  ensure(s.teams.some(t=>t.id===a.teamId),'TEAM','Team unbekannt');ensure(ANSWERED.includes(a.value),'VALUE','Bewertung ungültig');
  ensure(q?.round!=='hinweise'||a.value!=='richtig'||!!s.entries[a.teamId]?.lockLevel,'LOCK','Antwort nicht vorher abgegeben');
  next={...s,entries:{...s.entries,[a.teamId]:{...s.entries[a.teamId],judgement:a.value}}};break;
 case 'CONFIRM':phase('revealed');ensure(!s.awards.some(w=>w.questionId===q?.id),'REPLAY','Frage bereits gewertet');
  next={...s,phase:'graded',awards:[...s.awards,...taskAwards(s)]};break;
 case 'CORRECT':phase('graded');next={...s,phase:'revealed',awards:s.awards.filter(w=>w.questionId!==q?.id)};break;
 case 'ANNUL':phase('open','closed','revealed','graded');ensure(q,'PHASE','Keine Aufgabe');
  next={...s,phase:'graded',awards:[...s.awards.filter(w=>w.questionId!==q.id),...s.teams.map(t=>({teamId:t.id,questionId:q.id,points:0,judgement:'keine' as Judgement}))]};break;
 case 'NEXT':phase('graded');ensure(s.index<s.questions.length-1,'PHASE','Letzte Aufgabe');
  next={...s,index:s.index+1,phase:'ready',clueCount:0,entries:{}};break;
 case 'FINISH':phase('graded');ensure(s.index===s.questions.length-1,'PHASE','Noch Aufgaben übrig');next={...s,phase:'complete'};break;
 case 'PAUSE':ensure(s.phase!=='setup'&&s.phase!=='complete','PHASE','Pause unmöglich');next={...s,paused:true};break;
 case 'RESUME':ensure(s.paused,'PHASE','Keine Pause');next={...s,paused:false};break;
 }
 return {...next,revision:s.revision+1,audit:[...s.audit,{revision:s.revision+1,commandId:c.id,action:a.type,issuedAt:c.at}]};
}
export function eveningHalfPoints(s:Session):Record<Id,number>{
 const raw=scores(s),ordered=[...s.teams].sort((a,b)=>(raw[b.id]??0)-(raw[a.id]??0)),n=ordered.length,r:Record<string,number>={};
 for(let i=0;i<n;){let end=i+1;while(end<n&&raw[ordered[end]!.id]===raw[ordered[i]!.id])end++;
  const half=2*(n-i)-(end-i-1);for(let j=i;j<end;j++)r[ordered[j]!.id]=half;i=end;}
 return r;
}
export type PublicScene=
 |{kind:'waiting'|'paused';title:string}
 |{kind:'question';round:Round;current:number;total:number;prompt:string;choices?:readonly string[];clues:readonly string[]}
 |{kind:'answer';round:Round;prompt:string;solution:string}
 |{kind:'results';scores:Readonly<Record<Id,number>>;teams:readonly {id:Id;name:string}[];final:boolean;eveningHalfPoints?:Readonly<Record<Id,number>>};
export function publicScene(s:Session):PublicScene{
 if(s.paused)return {kind:'paused',title:'Pause'};
 if(s.phase==='complete')return {kind:'results',scores:scores(s),teams:s.teams.map(t=>({id:t.id,name:t.name})),final:true,eveningHalfPoints:eveningHalfPoints(s)};
 if(s.phase==='graded')return {kind:'results',scores:scores(s),teams:s.teams.map(t=>({id:t.id,name:t.name})),final:false};
 const q=currentQuestion(s);
 if(!q||s.phase==='setup'||s.phase==='ready')return {kind:'waiting',title:'Warte auf die Spielleitung'};
 if(s.phase==='revealed')return {kind:'answer',round:q.round,prompt:q.prompt,solution:q.answer};
 return {kind:'question',round:q.round,current:s.index+1,total:s.questions.length,prompt:q.prompt,
  ...(q.choices?{choices:q.choices}:{}),clues:q.round==='hinweise'?q.clues!.slice(0,s.clueCount):[]};
}
