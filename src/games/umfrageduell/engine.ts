/* G9 Umfrageduell: authoritative, offline, deliberately human-adjudicated shared surveys. */
export type Profile='kurz'|'standard'|'lang';
export type Format='popular'|'top3';
export type Phase='setup'|'ready'|'open'|'closed'|'revealed'|'graded'|'complete';
export type Category={label:string;synonyms:string[]};
export type Source=
 |{kind:'illustrative'}
 |{kind:'observed';source:string;population:string;method:string;collectedOn:string;limitations:string;reviewed:true};
export type Survey={id:string;format:Format;prompt:string;categories:[Category,Category,Category,Category,Category];source:Source};
export type Team={id:string;name:string;order:number};
export type Rank=1|2|3|4|5;
export type Submission={answers:string[];mapped:(Rank|null)[]};
export type Award={surveyId:string;teamId:string;points:number;annulled:boolean};
export type Session={
 id:string;ownerId:string;epoch:number;revision:number;profile:Profile;
 teams:Team[];surveys:Survey[];index:number;phase:Phase;paused:boolean;
 submissions:Record<string,Submission>;awards:Award[];
 audit:{revision:number;commandId:string;action:string;at:number}[];
};
export type Action=
 |{type:'START'|'PUBLISH'|'CLOSE'|'REVEAL'|'CONFIRM'|'NEXT'|'PAUSE'|'RESUME'}
 |{type:'RECORD';teamId:string;submission:Submission}
 |{type:'CORRECT';teamId:string;submission:Submission;reason:string}
 |{type:'ANNUL';reason:string};
export type Command={id:string;ownerId:string;epoch:number;expectedRevision:number;at:number;action:Action};
export class RuleError extends Error{
 constructor(readonly code:string,message:string){super(message);this.name='UmfrageduellRuleError';}
}
export const FORMAT_COUNTS:Record<Profile,{popular:number;top3:number}>={
 kurz:{popular:4,top3:0},standard:{popular:5,top3:1},lang:{popular:8,top3:2},
};
export const taskSeconds=(format:Format)=>format==='popular'?30:60;
export const orderedTeams=(s:Pick<Session,'teams'>)=>[...s.teams].sort((a,b)=>a.order-b.order);
export function canonical(text:string):string{return text.trim().toLocaleLowerCase('de-DE').normalize('NFKC').replace(/\s+/g,' ');}
export function validateContent(teams:readonly Team[],profile:Profile,surveys:readonly Survey[]):void{
 if(!FORMAT_COUNTS[profile])throw new RuleError('PROFILE','Unbekanntes Profil');
 if(teams.length<3||teams.length>5||new Set(teams.map(t=>t.id)).size!==teams.length||
    new Set(teams.map(t=>t.order)).size!==teams.length||teams.some(t=>!t.id||!t.name.trim()))
    throw new RuleError('ROSTER','Es müssen drei bis fünf eindeutige Teams sein');
 const counts=FORMAT_COUNTS[profile];
 if(surveys.length!==counts.popular+counts.top3||new Set(surveys.map(t=>t.id)).size!==surveys.length||
    surveys.filter(t=>t.format==='popular').length!==counts.popular||
    surveys.filter(t=>t.format==='top3').length!==counts.top3)
    throw new RuleError('CONTENT','Falsche Anzahl oder Art der Umfrageaufgaben');
 for(const task of surveys){
  if(!task.id||!task.prompt.trim()||task.categories.length!==5)
   throw new RuleError('CONTENT','Umfrage braucht Frage und genau fünf Kategorien');
  const labelsAndSynonyms=new Set<string>();
  task.categories.forEach(c=>{
   if(!c.label.trim()||!Array.isArray(c.synonyms))throw new RuleError('CATEGORY','Kategorie unvollständig');
   for(const term of [c.label,...c.synonyms]){
    const normalized=canonical(term);
    if(!normalized||labelsAndSynonyms.has(normalized))
      throw new RuleError('CATEGORY','Leere oder kollidierende Kategorie/Synonyme');
    labelsAndSynonyms.add(normalized);
   }
  });
  if(task.source.kind==='observed'){
   const s=task.source;
   if(!s.reviewed||![s.source,s.population,s.method,s.collectedOn,s.limitations].every(v=>v.trim().length>=3))
    throw new RuleError('SOURCE','Reale Umfrage benötigt überprüfte Herkunft, Zeitraum und Einschränkungen');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(s.collectedOn))
    throw new RuleError('SOURCE','Erhebungsdatum muss YYYY-MM-DD sein');
  }else if(task.source.kind!=='illustrative')throw new RuleError('SOURCE','Unbekannter Herkunftstyp');
 }
}
export function createSession(seed:{id:string;ownerId:string;profile:Profile;teams:readonly Team[];surveys:readonly Survey[]}):Session{
 if(!seed.id||!seed.ownerId)throw new RuleError('SETUP','Sitzungs-ID und Host erforderlich');
 validateContent(seed.teams,seed.profile,seed.surveys);
 return {...seed,teams:[...seed.teams],surveys:[...seed.surveys],epoch:1,revision:0,index:0,
   phase:'setup',paused:false,submissions:{},awards:[],audit:[]};
}
export function currentSurvey(s:Session):Survey{
 const task=s.surveys[s.index];
 if(!task)throw new RuleError('COMPLETE','Keine aktive Umfrage');
 return task;
}
export function validateSubmission(task:Survey,submission:Submission):void{
 const n=task.format==='popular'?1:3;
 if(submission.answers.length!==submission.mapped.length||
    (submission.answers.length!==0&&submission.answers.length!==n))
  throw new RuleError('ANSWER','Bitte genau '+n+' Antworten erfassen oder „Keine Antwort“ markieren');
 if(submission.answers.some(a=>!a.trim()||a.length>300)||
    submission.mapped.some(r=>r!==null&&![1,2,3,4,5].includes(r)))
  throw new RuleError('ANSWER','Leere, zu lange oder ungültig zugeordnete Antwort');
}
export function suggestMatch(task:Survey,answer:string):Rank|null{
 const text=canonical(answer);
 if(!text)return null;
 const matches=task.categories.flatMap((c,i)=>[c.label,...c.synonyms].some(v=>canonical(v)===text)?[i+1]:[]);
 return matches.length===1?matches[0] as Rank:null;
}
const popularPoints=[20,15,10,5,2];
export function pointsFor(task:Survey,submission:Submission):number{
 validateSubmission(task,submission);
 if(submission.answers.length===0)return 0;
 if(task.format==='popular')return submission.mapped[0]?popularPoints[submission.mapped[0]-1]??0:0;
 let points=0;
 const seen=new Set<Rank>();
 submission.mapped.forEach((rank,i)=>{
  if(rank===null||seen.has(rank))return;
  seen.add(rank);
  if(rank<=3)points+=rank===i+1?10:5;
 });
 return points;
}
export function awardsFor(s:Session):Award[]{
 const survey=currentSurvey(s);
 return orderedTeams(s).map(team=>{
  const submission=s.submissions[team.id];
  if(!submission)throw new RuleError('SUBMISSION','Team nicht erfasst: '+team.name);
  return {surveyId:survey.id,teamId:team.id,points:pointsFor(survey,submission),annulled:false};
 });
}
export function scores(s:Session):Record<string,number>{
 const result:Record<string,number>=Object.fromEntries(s.teams.map(t=>[t.id,0]));
 for(const award of s.awards){
  if(!Object.hasOwn(result,award.teamId))throw new RuleError('SCORE','Unbekanntes Team');
  result[award.teamId]=(result[award.teamId]??0)+award.points;
 }
 return result;
}
export function eveningHalfPoints(s:Session):Record<string,number>{
 const raw=scores(s),ranked=orderedTeams(s).sort((a,b)=>(raw[b.id]??0)-(raw[a.id]??0));
 const result:Record<string,number>={};let i=0;
 while(i<ranked.length){
  let j=i+1;while(j<ranked.length&&raw[ranked[j]!.id]===raw[ranked[i]!.id])j++;
  const half=2*(ranked.length-i)-(j-i-1);
  for(let k=i;k<j;k++)result[ranked[k]!.id]=half;
  i=j;
 }
 return result;
}
export function transition(s:Session,c:Command):Session{
 if(c.ownerId!==s.ownerId||c.epoch!==s.epoch)throw new RuleError('HOST','Falscher Host');
 if(c.expectedRevision!==s.revision)throw new RuleError('REVISION','Revision veraltet');
 if(s.audit.some(x=>x.commandId===c.id))throw new RuleError('REPLAY','Kommando wiederholt');
 if(s.paused&&c.action.type!=='RESUME')throw new RuleError('PAUSED','Spiel pausiert');
 const a=c.action;
 const phase=(...allowed:Phase[])=>{if(!allowed.includes(s.phase))throw new RuleError('PHASE','Aktion '+a.type+' hier nicht möglich');};
 const team=(id:string)=>{if(!s.teams.some(t=>t.id===id))throw new RuleError('TEAM','Unbekanntes Team');};
 let next:Session=s;
 switch(a.type){
  case 'START':phase('setup');next={...s,phase:'ready'};break;
  case 'PUBLISH':phase('ready');next={...s,phase:'open'};break;
  case 'CLOSE':phase('open');next={...s,phase:'closed'};break;
  case 'RECORD':phase('closed');team(a.teamId);
   validateSubmission(currentSurvey(s),a.submission);
   next={...s,submissions:{...s.submissions,[a.teamId]:a.submission}};break;
  case 'REVEAL':phase('closed');
   if(s.teams.some(t=>!s.submissions[t.id]))throw new RuleError('SUBMISSION','Alle Teamantworten vor Auflösung erfassen');
   next={...s,phase:'revealed'};break;
  case 'CONFIRM':phase('revealed');
   next={...s,awards:[...s.awards,...awardsFor(s)],phase:'graded'};break;
  case 'CORRECT':phase('graded');team(a.teamId);
   if(a.reason.trim().length<3)throw new RuleError('REASON','Begründung für Korrektur fehlt');
   if(s.awards.some(x=>x.surveyId===currentSurvey(s).id&&x.annulled))
    throw new RuleError('ANNUL','Annullierte Aufgabe kann nicht korrigiert werden');
   validateSubmission(currentSurvey(s),a.submission);
   const revised={...s,submissions:{...s.submissions,[a.teamId]:a.submission}};
   next={...revised,awards:[
     ...s.awards.filter(x=>x.surveyId!==currentSurvey(s).id),...awardsFor(revised)
   ]};break;
  case 'ANNUL':phase('ready','open','closed','revealed','graded');
   if(a.reason.trim().length<3)throw new RuleError('REASON','Begründung für Annullierung fehlt');
   next={...s,phase:'graded',awards:[
     ...s.awards.filter(x=>x.surveyId!==currentSurvey(s).id),
     ...s.teams.map(t=>({surveyId:currentSurvey(s).id,teamId:t.id,points:0,annulled:true}))
   ]};break;
  case 'NEXT':phase('graded');
   next={...s,index:s.index+1,phase:s.index+1===s.surveys.length?'complete':'ready',
    submissions:{}};break;
  case 'PAUSE':phase('ready','open','closed','revealed','graded');
   next={...s,paused:true};break;
  case 'RESUME':
   if(!s.paused)throw new RuleError('PHASE','Spiel nicht pausiert');
   next={...s,paused:false};break;
 }
 return {...next,revision:s.revision+1,audit:[...s.audit,{
  revision:s.revision+1,commandId:c.id,action:a.type,at:c.at,
 }]};
}
export type PublicScene=
 |{kind:'waiting'|'paused'}
 |{kind:'prompt';format:Format;step:number;total:number;prompt:string;source:Source}
 |{kind:'reveal';format:Format;step:number;total:number;prompt:string;source:Source;categories:string[]}
 |{kind:'scores';teams:{id:string;name:string;points:number}[];final:boolean};
export function publicScene(s:Session):PublicScene{
 if(s.paused)return {kind:'paused'};
 if(s.phase==='setup'||s.phase==='ready')return {kind:'waiting'};
 if(s.phase==='graded'||s.phase==='complete'){
  const raw=scores(s);
  return {kind:'scores',final:s.phase==='complete',
   teams:orderedTeams(s).map(t=>({id:t.id,name:t.name,points:raw[t.id]??0}))};
 }
 const survey=currentSurvey(s),shared={
  format:survey.format,step:s.index+1,total:s.surveys.length,prompt:survey.prompt,source:survey.source,
 };
 return s.phase==='revealed'?{kind:'reveal',...shared,categories:survey.categories.map(c=>c.label)}:
  {kind:'prompt',...shared};
}
