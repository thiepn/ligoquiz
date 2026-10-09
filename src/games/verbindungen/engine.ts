/** BP-03 Verbindungen. Pure rules; no timers, DOM, network or persistence. */
export type Profile='kurz'|'standard'|'lang';
export type Team={id:string;name:string;order:number};
export type Clue={id:string;kind:'clues';target:string;clues:readonly [string,string,string,string];reference:string};
export type Sequence={id:string;kind:'sequence';prompt:string;items:readonly [string,string,string];answer:string;explanation:string;reference:string};
export type WallGroup={id:string;tileIds:readonly [string,string,string,string];link:string;acceptedLinks:readonly string[]};
export type Wall={id:string;kind:'wall';tiles:readonly {id:string;label:string}[];groups:readonly WallGroup[];reference:string};
export type Puzzle=Clue|Sequence|Wall;
export type Assignment={puzzleId:string;kind:Puzzle['kind'];teamId:string|null};
export type Judgement='correct'|'wrong'|'none';
export type GroupMark={group:boolean;link:boolean};
export type TeamWallMark=Record<string,GroupMark>;
export type Award={puzzleId:string;teamId:string;points:number;annulled:boolean};
export type Phase='setup'|'ready'|'clue-open'|'sequence-open'|'wall-open'|'wall-closed'|
 'wall-reveal'|'revealed'|'graded'|'complete';
export type Session={
 id:string;ownerId:string;epoch:number;revision:number;profile:Profile;
 teams:readonly Team[];puzzles:readonly Puzzle[];assignments:readonly Assignment[];
 index:number;phase:Phase;paused:boolean;clueIndex:number;judgement:Judgement|null;
 revealedGroups:number;wallMarks:Record<string,TeamWallMark>;
 awards:readonly Award[];audit:readonly {revision:number;commandId:string;action:string;at:number}[];
};
export type Action=
 |{type:'START'}|{type:'PUBLISH'}|{type:'NEXT_CLUE'}|{type:'JUDGE';value:Judgement}
 |{type:'CLOSE_WALL'}|{type:'REVEAL_WALL_GROUP'}|{type:'MARK_GROUP';teamId:string;groupId:string;correct:boolean}
 |{type:'MARK_LINK';teamId:string;groupId:string;correct:boolean}
 |{type:'REVEAL'}|{type:'CONFIRM'}|{type:'CORRECT'}|{type:'ANNUL';reason:string}
 |{type:'NEXT'}|{type:'PAUSE'}|{type:'RESUME'};
export type Command={id:string;ownerId:string;epoch:number;expectedRevision:number;at:number;action:Action};
export class RuleError extends Error{constructor(readonly code:string,message:string){super(message);this.name='RuleError';}}
function assert(ok:unknown,code:string,msg:string):asserts ok{if(!ok)throw new RuleError(code,msg);}
export const NEEDS:Record<Profile,{clues:number;sequences:number;wall:number}>={
 kurz:{clues:1,sequences:0,wall:1},
 standard:{clues:1,sequences:1,wall:1},
 lang:{clues:2,sequences:1,wall:1},
};
export function teamsInOrder(s:Pick<Session,'teams'>):Team[]{return [...s.teams].sort((a,b)=>a.order-b.order);}
export function active(s:Session):{assignment:Assignment;puzzle:Puzzle}{
 const assignment=s.assignments[s.index];assert(assignment,'TASK','Keine aktive Aufgabe');
 const puzzle=s.puzzles.find(p=>p.id===assignment.puzzleId);
 assert(puzzle&&puzzle.kind===assignment.kind,'CORRUPT','Zugewiesene Aufgabe fehlt');
 return {assignment,puzzle};
}
export function validateContent(teams:readonly Team[],profile:Profile,puzzles:readonly Puzzle[]):void{
 assert(teams.length>=3&&teams.length<=5,'TEAMS','Es müssen 3–5 Teams sein');
 assert(teams.every(t=>t.id.trim()&&t.name.trim()&&t.name.length<=40&&Number.isInteger(t.order)&&t.order>=0),'TEAMS','Ungültige Teamdaten');
 assert(new Set(teams.map(t=>t.id)).size===teams.length&&new Set(teams.map(t=>t.order)).size===teams.length,'TEAMS','Doppelte Team-IDs oder Positionen');
 const needs=NEEDS[profile],byKind=(kind:Puzzle['kind'])=>puzzles.filter(p=>p.kind===kind);
 assert(byKind('clues').length===needs.clues*teams.length,'CONTENT','Nicht genügend fair verteilte Vier-Hinweise-Fragen');
 assert(byKind('sequence').length===needs.sequences*teams.length,'CONTENT','Nicht genügend Folgen');
 assert(byKind('wall').length===1,'CONTENT','Genau eine Verbindungswand erforderlich');
 assert(puzzles.every(p=>p.id.trim()&&p.reference.trim()),'CONTENT','Quellenangaben fehlen');
 assert(new Set(puzzles.map(p=>p.id)).size===puzzles.length,'CONTENT','Aufgaben-IDs doppelt');
 for(const p of puzzles){
  if(p.kind==='clues'){
   assert(p.target.trim()&&p.clues.length===4&&p.clues.every(x=>x.trim()),'CONTENT','Vier eindeutig benannte Hinweise nötig');
  } else if(p.kind==='sequence'){
   assert(p.prompt.trim()&&p.items.length===3&&p.items.every(x=>x.trim())&&p.answer.trim()&&p.explanation.trim(),'CONTENT','Dreierfolge mit eindeutiger Regel fehlt');
  } else {
   assert(p.tiles.length===16&&p.groups.length===4,'WALL','Wand erfordert 16 Felder und 4 Gruppen');
   assert(p.tiles.every(t=>t.id.trim()&&t.label.trim()),'WALL','Unvollständiges Wandfeld');
   assert(new Set(p.tiles.map(t=>t.id)).size===16&&new Set(p.groups.map(g=>g.id)).size===4,'WALL','Wand-IDs doppelt');
   const ids=p.groups.flatMap(g=>[...g.tileIds]);
   assert(ids.length===16&&new Set(ids).size===16&&ids.every(x=>p.tiles.some(t=>t.id===x)),'WALL','Gruppen müssen die 16 Felder überschneidungsfrei aufteilen');
   assert(p.groups.every(g=>g.tileIds.length===4&&g.link.trim()&&g.acceptedLinks.length>0),'WALL','Gruppenverbindungen fehlen');
  }
 }
}
export function createSession(args:{id:string;ownerId:string;profile:Profile;teams:readonly Team[];puzzles:readonly Puzzle[]}):Session{
 assert(!!args.id&&!!args.ownerId,'SETUP','Event- und Host-ID erforderlich');
 validateContent(args.teams,args.profile,args.puzzles);
 const teams=teamsInOrder(args),clues=args.puzzles.filter(p=>p.kind==='clues');
 const seq=args.puzzles.filter(p=>p.kind==='sequence'),wall=args.puzzles.find(p=>p.kind==='wall')!;
 const assignments:Assignment[]=[];
 for(let turn=0;turn<NEEDS[args.profile].clues;turn++)
  for(const [i,t] of teams.entries())assignments.push({puzzleId:clues[turn*teams.length+i]!.id,kind:'clues',teamId:t.id});
 for(const [i,t] of teams.entries())if(NEEDS[args.profile].sequences)
  assignments.push({puzzleId:seq[i]!.id,kind:'sequence',teamId:t.id});
 assignments.push({puzzleId:wall.id,kind:'wall',teamId:null});
 return {...args,teams,puzzles:[...args.puzzles],assignments,index:0,
  epoch:1,revision:0,phase:'setup',paused:false,clueIndex:0,judgement:null,
  revealedGroups:0,wallMarks:{},awards:[],audit:[]};
}
export function scores(s:Session):Record<string,number>{
 const r:Record<string,number>=Object.fromEntries(s.teams.map(t=>[t.id,0]));
 for(const a of s.awards){assert(Object.hasOwn(r,a.teamId),'CORRUPT','Unbekanntes Team');r[a.teamId]=(r[a.teamId]??0)+a.points;}
 return r;
}
export function eveningHalfPoints(s:Session):Record<string,number>{
 const score=scores(s),teams=teamsInOrder(s).sort((a,b)=>(score[b.id]??0)-(score[a.id]??0));
 const n=teams.length,res:Record<string,number>={};let i=0;
 while(i<n){let j=i+1;while(j<n&&score[teams[j]!.id]===score[teams[i]!.id])j++;
  const half=2*(n-i)-(j-i-1);for(let k=i;k<j;k++)res[teams[k]!.id]=half;i=j;}
 return res;
}
export function wallAwards(s:Session):Award[]{
 const {puzzle}=active(s);assert(puzzle.kind==='wall','PHASE','Keine Wand');
 return s.teams.map(t=>{
  const marks=s.wallMarks[t.id];assert(marks,'RESPONSE','Wertung fehlt: '+t.name);
  let points=0;
  for(const group of puzzle.groups){
   const mark=marks[group.id];assert(mark,'RESPONSE','Wertung fehlt: '+t.name+' / '+group.id);
   assert(!mark.link||mark.group,'RESPONSE','Verbindung ohne korrekte Vierergruppe');
   points+=mark.group?5+(mark.link?5:0):0;
  }
  return {puzzleId:puzzle.id,teamId:t.id,points,annulled:false};
 });
}
function awardsFor(s:Session):Award[]{
 const {assignment,puzzle}=active(s);
 if(puzzle.kind==='wall')return wallAwards(s);
 assert(assignment.teamId&&s.judgement,'RESPONSE','Teamwertung fehlt');
 return [{puzzleId:puzzle.id,teamId:assignment.teamId,
  points:s.judgement!=='correct'?0:puzzle.kind==='clues'?(5-s.clueIndex)*10:20,
  annulled:false}];
}
export function transition(s:Session,c:Command):Session{
 assert(c.ownerId===s.ownerId&&c.epoch===s.epoch,'HOST','Falsche Host-Instanz');
 assert(c.expectedRevision===s.revision,'REVISION','Revision veraltet');
 assert(!s.audit.some(x=>x.commandId===c.id),'REPLAY','Kommando bereits verarbeitet');
 const a=c.action,task=active(s);
 const requirePhase=(...p:Phase[])=>assert(p.includes(s.phase),'PHASE','Aktion '+a.type+' hier nicht erlaubt');
 if(s.paused&&a.type!=='RESUME')throw new RuleError('PAUSED','Spiel ist pausiert');
 let next=s;
 switch(a.type){
  case 'START':requirePhase('setup');next={...s,phase:'ready'};break;
  case 'PUBLISH':
   requirePhase('ready');
   next={...s,phase:task.puzzle.kind==='clues'?'clue-open':task.puzzle.kind==='sequence'?'sequence-open':'wall-open',
    clueIndex:task.puzzle.kind==='clues'?1:0};
   break;
  case 'NEXT_CLUE':
   requirePhase('clue-open');assert(!s.judgement,'LOCK','Ein finaler Versuch wurde bereits abgegeben');assert(s.clueIndex<4,'PHASE','Alle Hinweise gezeigt');
   next={...s,clueIndex:s.clueIndex+1};break;
  case 'JUDGE':
   requirePhase('clue-open','sequence-open');
   assert(!s.judgement,'LOCK','Ein finaler Versuch wurde bereits abgegeben');
   next={...s,judgement:a.value};break;
  case 'CLOSE_WALL':
   requirePhase('wall-open');next={...s,phase:'wall-closed'};break;
  case 'REVEAL_WALL_GROUP':
   requirePhase('wall-closed','wall-reveal');
   assert(task.puzzle.kind==='wall'&&s.revealedGroups<4,'PHASE','Alle Gruppen schon gezeigt');
   if(s.revealedGroups>0){
     const previous=task.puzzle.groups[s.revealedGroups-1]!;
     assert(s.teams.every(t=>Boolean(s.wallMarks[t.id]?.[previous.id])),
       'RESPONSE','Zuerst die aktuelle Gruppe für jedes Team werten');
   }
   next={...s,revealedGroups:s.revealedGroups+1,phase:'wall-reveal'};break;
  case 'MARK_GROUP':
   requirePhase('wall-reveal');
   assert(s.teams.some(t=>t.id===a.teamId),'TEAM','Unbekanntes Team');
   assert(task.puzzle.kind==='wall'&&task.puzzle.groups.some(g=>g.id===a.groupId),'GROUP','Gruppe fehlt');
   assert(task.puzzle.groups.findIndex(g=>g.id===a.groupId)<s.revealedGroups,'GROUP','Gruppe noch nicht öffentlich');
   next={...s,wallMarks:{...s.wallMarks,[a.teamId]:{...s.wallMarks[a.teamId],
      [a.groupId]:{group:a.correct,link:a.correct?(s.wallMarks[a.teamId]?.[a.groupId]?.link??false):false}}}};
   break;
  case 'MARK_LINK':
   requirePhase('wall-reveal');
   assert(s.teams.some(t=>t.id===a.teamId),'TEAM','Unbekanntes Team');
   assert(task.puzzle.kind==='wall'&&task.puzzle.groups.some(g=>g.id===a.groupId),'GROUP','Gruppe fehlt');
   assert(task.puzzle.groups.findIndex(g=>g.id===a.groupId)<s.revealedGroups,'GROUP','Gruppe noch nicht öffentlich');
   assert(!a.correct||s.wallMarks[a.teamId]?.[a.groupId]?.group,'RESPONSE','Link nur für korrekte Vierergruppe');
   next={...s,wallMarks:{...s.wallMarks,[a.teamId]:{...s.wallMarks[a.teamId],
     [a.groupId]:{group:s.wallMarks[a.teamId]?.[a.groupId]?.group??false,link:a.correct}}}};
   break;
  case 'REVEAL':
   requirePhase('clue-open','sequence-open');
   assert(s.judgement,'RESPONSE','Zuerst Antwortversuch abschließen');
   next={...s,phase:'revealed'};break;
  case 'CONFIRM':{
   requirePhase('revealed','wall-reveal');
   if(task.puzzle.kind==='wall')assert(s.revealedGroups===4,'PHASE','Erst alle vier Gruppen zeigen');
   const awards=awardsFor(s);
   assert(!s.awards.some(x=>x.puzzleId===task.puzzle.id),'REPLAY','Bereits gewertet');
   next={...s,phase:'graded',awards:[...s.awards,...awards]};break;
  }
  case 'CORRECT':
   requirePhase('graded');
   assert(s.awards.some(x=>x.puzzleId===task.puzzle.id&&!x.annulled),'PHASE','Annullierte Aufgabe wird nicht aufgedeckt');
   next={...s,phase:task.puzzle.kind==='wall'?'wall-reveal':'revealed',
    awards:s.awards.filter(x=>x.puzzleId!==task.puzzle.id)};break;
  case 'ANNUL':
   requirePhase('ready','clue-open','sequence-open','wall-open','wall-closed','wall-reveal','revealed','graded');
   assert(a.reason.trim().length>=3,'REASON','Annullierung benötigt Grund');
   next={...s,phase:'graded',awards:[
    ...s.awards.filter(x=>x.puzzleId!==task.puzzle.id),
    ...(task.puzzle.kind==='wall'?s.teams.map(t=>({puzzleId:task.puzzle.id,teamId:t.id,points:0,annulled:true})):
      [{puzzleId:task.puzzle.id,teamId:task.assignment.teamId!,points:0,annulled:true}])
   ]};break;
  case 'NEXT':
   requirePhase('graded');
   next={...s,index:s.index+1,phase:s.index+1===s.assignments.length?'complete':'ready',
    clueIndex:0,judgement:null,revealedGroups:0,wallMarks:{}};break;
  case 'PAUSE':
   assert(s.phase!=='setup'&&s.phase!=='complete','PHASE','Pause unmöglich');
   next={...s,paused:true};break;
  case 'RESUME':
   assert(s.paused,'PHASE','Nicht pausiert');next={...s,paused:false};break;
 }
 return {...next,revision:s.revision+1,audit:[...s.audit,{
  revision:s.revision+1,commandId:c.id,action:a.type,at:c.at}]};
}
export type PublicScene=
 |{kind:'waiting'|'paused'}
 |{kind:'clues';activeTeam:string;clues:readonly string[];number:number}
 |{kind:'sequence';activeTeam:string;prompt:string;items:readonly string[]}
 |{kind:'wall';tiles:readonly {id:string;label:string}[];revealed:readonly {id:string;tileIds:readonly string[];link:string}[]}
 |{kind:'answer';prompt:string;answer:string}
 |{kind:'scores';teams:readonly {id:string;name:string;points:number}[];final:boolean};
export function publicScene(s:Session):PublicScene{
 if(s.paused)return {kind:'paused'};
 if(s.phase==='setup'||s.phase==='ready')return {kind:'waiting'};
 if(s.phase==='graded'||s.phase==='complete')return {kind:'scores',final:s.phase==='complete',
  teams:teamsInOrder(s).map(t=>({id:t.id,name:t.name,points:scores(s)[t.id]??0}))};
 const {assignment,puzzle}=active(s);
 if(puzzle.kind==='clues'){
  if(s.phase==='revealed')return {kind:'answer',prompt:'Vier Hinweise',answer:puzzle.target};
  return {kind:'clues',activeTeam:s.teams.find(t=>t.id===assignment.teamId)?.name??'',
   clues:puzzle.clues.slice(0,s.clueIndex),number:s.clueIndex};
 }
 if(puzzle.kind==='sequence'){
  if(s.phase==='revealed')return {kind:'answer',prompt:'Folge ergänzen',answer:puzzle.answer+' — '+puzzle.explanation};
  return {kind:'sequence',activeTeam:s.teams.find(t=>t.id===assignment.teamId)?.name??'',prompt:puzzle.prompt,items:puzzle.items};
 }
 return {kind:'wall',tiles:puzzle.tiles,
  revealed:puzzle.groups.slice(0,s.revealedGroups).map(g=>({id:g.id,tileIds:g.tileIds,link:g.link}))};
}
