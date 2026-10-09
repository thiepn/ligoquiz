export type Profile='kurz'|'standard'|'lang';
export type Phase='setup'|'ready'|'open'|'closed'|'revealed'|'graded'|'complete';
export type Team={id:string;name:string;order:number};
export type Rung={
 id:string;difficulty:number;kind:'deduction'|'numeric'|'ordering'|'constraint';
 prompt:string;hint:string;answer:string;explanation:string;reference:string;
};
export type Lock={hintRevision:0|1};
export type Grade='correct'|'wrong'|'absent';
export type Award={rungId:string;teamId:string;points:number;annulled:boolean};
export type Session={
 id:string;ownerId:string;epoch:number;revision:number;profile:Profile;
 teams:Team[];rungs:Rung[];index:number;phase:Phase;paused:boolean;
 hintShown:boolean;fairHint:boolean;locks:Record<string,Lock>;
 grades:Record<string,Grade>;awards:Award[];
 audit:{revision:number;commandId:string;action:string;at:number}[];
};
export type Action=
 |{type:'START'|'PUBLISH'|'HINT'|'CLOSE'|'REVEAL'|'CONFIRM'|'CORRECT'|'NEXT'|'PAUSE'|'RESUME'}
 |{type:'LOCK';teamId:string}
 |{type:'GRADE';teamId:string;value:Grade}
 |{type:'FAIR_HINT';reason:string}
 |{type:'ANNUL';reason:string};
export type Command={id:string;ownerId:string;epoch:number;expectedRevision:number;at:number;action:Action};
export class RuleError extends Error{
 constructor(readonly code:string,message:string){super(message);this.name='LogikleiterRuleError';}
}
const assert=(yes:unknown,code:string,message:string):asserts yes=>{
 if(!yes)throw new RuleError(code,message);
};
export const LENGTH:Record<Profile,number>={kurz:3,standard:5,lang:7};
export const rungValue=(index:number)=>10*(index+1);
export const rungSeconds=(index:number)=>index<2?60:index<5?90:120;
export const orderedTeams=(s:Pick<Session,'teams'>)=>[...s.teams].sort((a,b)=>a.order-b.order);
export function validateContent(teams:readonly Team[],profile:Profile,rungs:readonly Rung[]):void{
 if(teams.length<3||teams.length>5||new Set(teams.map(t=>t.id)).size!==teams.length||
    new Set(teams.map(t=>t.order)).size!==teams.length||teams.some(t=>!t.id||!t.name.trim()))
    throw new RuleError('ROSTER','Genau drei bis fünf eindeutige Teams erforderlich');
 if(rungs.length!==LENGTH[profile]||new Set(rungs.map(r=>r.id)).size!==rungs.length)
    throw new RuleError('CONTENT','Genau die Stufen des gewählten Profils erforderlich');
 rungs.forEach((r,i)=>{
   if(!r.id||r.difficulty!==i+1||!r.prompt.trim()||!r.hint.trim()||
      !r.answer.trim()||!r.explanation.trim()||!r.reference.trim())
      throw new RuleError('CONTENT','Stufe, Lösung, Hinweis oder Begründung fehlt');
   if(r.hint.trim().toLocaleLowerCase('de-DE')===r.answer.trim().toLocaleLowerCase('de-DE'))
      throw new RuleError('CONTENT','Hinweis verrät unmittelbar die Lösung');
 });
}
export function createSession(seed:{id:string;ownerId:string;profile:Profile;teams:readonly Team[];rungs:readonly Rung[]}):Session{
 if(!seed.id||!seed.ownerId)throw new RuleError('SETUP','Sitzungs- und Host-ID erforderlich');
 validateContent(seed.teams,seed.profile,seed.rungs);
 return {...seed,teams:[...seed.teams],rungs:[...seed.rungs],epoch:1,revision:0,
  index:0,phase:'setup',paused:false,hintShown:false,fairHint:false,
  locks:{},grades:{},awards:[],audit:[]};
}
export const currentRung=(s:Session):Rung=>{
 const r=s.rungs[s.index];if(!r)throw new RuleError('COMPLETE','Keine aktive Stufe');
 return r;
};
export function scores(s:Session):Record<string,number>{
 const result:Record<string,number>=Object.fromEntries(s.teams.map(t=>[t.id,0]));
 for(const a of s.awards){
  if(!Object.hasOwn(result,a.teamId))throw new RuleError('SCORE','Unbekanntes Team');
  result[a.teamId]=(result[a.teamId]??0)+a.points;
 }
 return result;
}
export function eveningHalfPoints(s:Session):Record<string,number>{
 const score=scores(s),teams=orderedTeams(s).sort((a,b)=>(score[b.id]??0)-(score[a.id]??0));
 const result:Record<string,number>={};let i=0;
 while(i<teams.length){
  let j=i+1;
  while(j<teams.length&&score[teams[j]!.id]===score[teams[i]!.id])j++;
  const half=2*(teams.length-i)-(j-i-1);
  for(let k=i;k<j;k++)result[teams[k]!.id]=half;
  i=j;
 }
 return result;
}
export function awardsFor(s:Session):Award[]{
 const r=currentRung(s);
 return orderedTeams(s).map(t=>{
  const grade=s.grades[t.id];
  if(!grade)throw new RuleError('GRADE','Wertung fehlt: '+t.name);
  const lock=s.locks[t.id];
  if(grade==='correct'&&!lock)throw new RuleError('LOCK','Richtige Antwort ohne erfasste Abgabe');
  return {rungId:r.id,teamId:t.id,points:grade==='correct'?
   (lock?.hintRevision===1&&!s.fairHint?rungValue(s.index)/2:rungValue(s.index)):0,annulled:false};
 });
}
export function transition(s:Session,c:Command):Session{
 if(c.ownerId!==s.ownerId||c.epoch!==s.epoch)throw new RuleError('HOST','Falsche Host-Instanz');
 if(c.expectedRevision!==s.revision)throw new RuleError('REVISION','Revision veraltet');
 if(s.audit.some(x=>x.commandId===c.id))throw new RuleError('REPLAY','Kommando wiederholt');
 const a=c.action;
 if(s.paused&&a.type!=='RESUME')throw new RuleError('PAUSED','Spiel pausiert');
 const phase=(...allowed:Phase[])=>{
  if(!allowed.includes(s.phase))throw new RuleError('PHASE','Aktion '+a.type+' hier nicht erlaubt');
 };
 const team=(teamId:string)=>{
  if(!s.teams.some(t=>t.id===teamId))throw new RuleError('TEAM','Unbekanntes Team');
 };
 let next:Session=s;
 switch(a.type){
  case 'START':phase('setup');next={...s,phase:'ready'};break;
  case 'PUBLISH':phase('ready');next={...s,phase:'open'};break;
  case 'LOCK':phase('open');team(a.teamId);
    if(s.locks[a.teamId])throw new RuleError('LOCK','Abgabe bereits gesperrt');
    next={...s,locks:{...s.locks,[a.teamId]:{hintRevision:s.hintShown?1:0}}};break;
  case 'HINT':phase('open');
    if(s.hintShown)throw new RuleError('HINT','Hinweis bereits sichtbar');
    next={...s,hintShown:true};break;
  case 'FAIR_HINT':phase('open','closed','revealed');
    if(!s.hintShown||a.reason.trim().length<3)throw new RuleError('REASON','Grund für Hinweis-Korrektur fehlt');
    next={...s,fairHint:true};break;
  case 'CLOSE':phase('open');next={...s,phase:'closed'};break;
  case 'REVEAL':phase('closed');next={...s,phase:'revealed'};break;
  case 'GRADE':phase('revealed');team(a.teamId);
    if(a.value==='correct'&&!s.locks[a.teamId])throw new RuleError('LOCK','Vorherige Abgabe muss erfasst sein');
    next={...s,grades:{...s.grades,[a.teamId]:a.value}};break;
  case 'CONFIRM':phase('revealed');
    next={...s,phase:'graded',awards:[...s.awards,...awardsFor(s)]};break;
  case 'CORRECT':phase('graded');
    if(!s.awards.some(x=>x.rungId===currentRung(s).id&&!x.annulled))
      throw new RuleError('ANNUL','Annullierte Stufe kann nicht korrigiert werden');
    next={...s,phase:'revealed',awards:s.awards.filter(x=>x.rungId!==currentRung(s).id)};
    break;
  case 'ANNUL':phase('ready','open','closed','revealed','graded');
    if(a.reason.trim().length<3)throw new RuleError('REASON','Grund für Annullierung fehlt');
    next={...s,phase:'graded',awards:[
      ...s.awards.filter(x=>x.rungId!==currentRung(s).id),
      ...s.teams.map(t=>({rungId:currentRung(s).id,teamId:t.id,points:0,annulled:true}))
    ]};break;
  case 'NEXT':phase('graded');
    next={...s,index:s.index+1,phase:s.index+1===s.rungs.length?'complete':'ready',
      hintShown:false,fairHint:false,locks:{},grades:{}};break;
  case 'PAUSE':phase('ready','open','closed','revealed','graded');
    next={...s,paused:true};break;
  case 'RESUME':
    if(!s.paused)throw new RuleError('PHASE','Spiel ist nicht pausiert');
    next={...s,paused:false};break;
 }
 return {...next,revision:s.revision+1,audit:[...s.audit,{
  revision:s.revision+1,commandId:c.id,action:a.type,at:c.at
 }]};
}
export type PublicScene=
 |{kind:'waiting'|'paused'}
 |{kind:'ladder';step:number;total:number;points:number;prompt:string;hint:string|null}
 |{kind:'answer';step:number;total:number;points:number;prompt:string;answer:string;explanation:string}
 |{kind:'scores';teams:{id:string;name:string;points:number}[];final:boolean};
export function publicScene(s:Session):PublicScene{
 if(s.paused)return {kind:'paused'};
 if(s.phase==='setup'||s.phase==='ready')return {kind:'waiting'};
 if(s.phase==='graded'||s.phase==='complete')return {kind:'scores',final:s.phase==='complete',
  teams:orderedTeams(s).map(t=>({id:t.id,name:t.name,points:scores(s)[t.id]??0}))};
 const r=currentRung(s);
 if(s.phase==='revealed')return {kind:'answer',step:s.index+1,total:s.rungs.length,
  points:rungValue(s.index),prompt:r.prompt,answer:r.answer,explanation:r.explanation};
 return {kind:'ladder',step:s.index+1,total:s.rungs.length,points:rungValue(s.index),
  prompt:r.prompt,hint:s.hintShown?r.hint:null};
}
