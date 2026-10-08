/** BP-03 Quiztafel: pure deterministic game state machine, no browser dependencies. */
export type Profile = 'kurz' | 'standard' | 'lang';
export type Phase = 'setup' | 'board' | 'prepared' | 'question' | 'steal-offer' |
  'steal' | 'adjudicated' | 'revealed' | 'awarded' | 'complete';
export type Tile = {
  id:string; categoryId:string; row:number; value:number;
  prompt:string; answer:string; reference:string;
};
export type Category = {id:string; name:string};
export type Team = {id:string; name:string; order:number};
export type Result = 'correct' | 'wrong' | 'none';
export type Winner = 'selector' | 'stealer' | 'none';
export type Outcome = {
  tileId:string; selectorId:string; stealerId:string|null;
  winnerId:string|null; points:number; annulled:boolean;
};
export type AuditEntry = {revision:number; commandId:string; type:string; at:number};
export type Session = {
  id:string; ownerId:string; epoch:number; revision:number; profile:Profile;
  teams:readonly Team[]; categories:readonly Category[]; tiles:readonly Tile[];
  phase:Phase; paused:boolean; turn:number; selectedTileId:string|null;
  usedTileIds:readonly string[]; primaryResult:Result|null; stealResult:Result|'declined'|null;
  candidate:Winner|null; annulled:boolean;
  outcomes:readonly Outcome[]; audit:readonly AuditEntry[];
};
export type Action =
 |{type:'START'}|{type:'PICK';tileId:string}|{type:'UNPICK'}|{type:'PUBLISH'}
 |{type:'PRIMARY';result:Result}|{type:'OFFER_STEAL'}
 |{type:'STEAL';result:Result|'declined'}|{type:'REVEAL'}
 |{type:'ADJUST';winner:Winner}|{type:'CONFIRM'}|{type:'CORRECT'}
 |{type:'ANNUL';reason:string}|{type:'NEXT'}|{type:'PAUSE'}|{type:'RESUME'};
export type Command={id:string;ownerId:string;epoch:number;expectedRevision:number;at:number;action:Action};
export class QuiztafelError extends Error{
  constructor(readonly code:string,message:string){super(message);this.name='QuiztafelError';}
}
function requireRule(test:unknown,code:string,message:string):asserts test{
  if(!test)throw new QuiztafelError(code,message);
}
export const DEPTH:Record<Profile,number>={kurz:3,standard:5,lang:6};
export function orderedTeams(s:Pick<Session,'teams'>):Team[]{return [...s.teams].sort((a,b)=>a.order-b.order);}
export function selector(s:Session):Team{
  const teams=orderedTeams(s);return teams[s.turn%teams.length]!;
}
export function eligibleStealer(s:Session):Team{
  const teams=orderedTeams(s);return teams[(s.turn+1)%teams.length]!;
}
export function selectedTile(s:Session):Tile|null{
  return s.tiles.find(t=>t.id===s.selectedTileId)??null;
}
export function scores(s:Session):Record<string,number>{
  const result:Record<string,number>=Object.fromEntries(s.teams.map(t=>[t.id,0]));
  for(const award of s.outcomes){
    if(!award.winnerId)continue;
    requireRule(Object.hasOwn(result,award.winnerId),'CORRUPT','Gewinner ist unbekannt');
    result[award.winnerId]=(result[award.winnerId]??0)+award.points;
  }
  return result;
}
export function eveningHalfPoints(s:Session):Record<string,number>{
  const raw=scores(s),teams=orderedTeams(s).sort((a,b)=>(raw[b.id]??0)-(raw[a.id]??0));
  const n=teams.length, result:Record<string,number>={};
  for(let i=0;i<n;){
    let k=i+1;while(k<n&&raw[teams[k]!.id]===raw[teams[i]!.id])k++;
    const half=2*(n-i)-(k-i-1);
    for(let j=i;j<k;j++)result[teams[j]!.id]=half;
    i=k;
  }
  return result;
}
export function verifyBoard(args:{teams:readonly Team[];categories:readonly Category[];
  tiles:readonly Tile[];profile:Profile}):void{
  const {teams,categories,tiles,profile}=args,depth=DEPTH[profile];
  requireRule(teams.length>=3&&teams.length<=5,'ROSTER','Quiztafel benötigt 3–5 Teams');
  requireRule(teams.every(t=>t.id&&t.name.trim()&&t.name.length<=40&&Number.isSafeInteger(t.order)&&t.order>=0),'ROSTER','Teamdaten ungültig');
  requireRule(new Set(teams.map(t=>t.id)).size===teams.length&&new Set(teams.map(t=>t.order)).size===teams.length,'ROSTER','Team-IDs oder Reihenfolge doppelt');
  requireRule(categories.length===teams.length,'BOARD','Pro Team genau eine Kategorie');
  requireRule(categories.every(c=>c.id&&c.name.trim()&&c.name.length<=55),'BOARD','Ungültige Kategorie');
  requireRule(new Set(categories.map(c=>c.id)).size===categories.length&&new Set(categories.map(c=>c.name.trim().toLowerCase())).size===categories.length,'BOARD','Kategorien müssen verschieden sein');
  requireRule(tiles.length===teams.length*depth,'BOARD','Unvollständiges Spielfeld');
  requireRule(new Set(tiles.map(t=>t.id)).size===tiles.length,'BOARD','Feld-ID doppelt');
  for(const c of categories){
    for(let row=1;row<=depth;row++){
      const matching=tiles.filter(t=>t.categoryId===c.id&&t.row===row);
      requireRule(matching.length===1,'BOARD',c.name+' / '+row*100+' fehlt oder ist doppelt');
    }
  }
  for(const tile of tiles){
    requireRule(categories.some(c=>c.id===tile.categoryId)&&
      Number.isInteger(tile.row)&&tile.row>=1&&tile.row<=depth&&tile.value===tile.row*100,
      'BOARD','Feldwert oder Kategorie ungültig');
    requireRule(tile.id.trim()!==''&&tile.prompt.trim()!==''&&tile.answer.trim()!==''&&
      tile.reference.trim()!==''&&tile.prompt.length<=3000&&tile.answer.length<=2000,
      'CONTENT','Unvollständige Frage oder Quellenangabe');
  }
}
export function createSession(args:{id:string;ownerId:string;profile:Profile;
  teams:readonly Team[];categories:readonly Category[];tiles:readonly Tile[]}):Session{
  requireRule(!!args.id&&!!args.ownerId,'SETUP','Sitzungskennung fehlt');
  verifyBoard(args);
  return {...args,teams:orderedTeams(args),phase:'setup',paused:false,
    epoch:1,revision:0,turn:0,selectedTileId:null,usedTileIds:[],
    primaryResult:null,stealResult:null,candidate:null,annulled:false,outcomes:[],audit:[]};
}
function winnerId(s:Session):string|null{
  return s.candidate==='selector'?selector(s).id:
    s.candidate==='stealer'?eligibleStealer(s).id:null;
}
function makeOutcome(s:Session,annulled:boolean):Outcome{
  const tile=selectedTile(s);requireRule(tile,'PHASE','Kein aktives Feld');
  const winning=annulled?null:winnerId(s);
  return {tileId:tile.id,selectorId:selector(s).id,
    stealerId:s.primaryResult&&s.primaryResult!=='correct'?eligibleStealer(s).id:null,
    winnerId:winning,points:winning?tile.value:0,annulled};
}
export function transition(s:Session,c:Command):Session{
  requireRule(c.ownerId===s.ownerId&&c.epoch===s.epoch,'HOST','Spielleitung besitzt die Sitzung nicht');
  requireRule(c.expectedRevision===s.revision,'REVISION','Spielstand hat sich geändert');
  requireRule(!s.audit.some(a=>a.commandId===c.id),'REPLAY','Befehl wurde bereits angewendet');
  const a=c.action,phase=(...list:Phase[])=>requireRule(list.includes(s.phase),'PHASE','Aktion '+a.type+' in dieser Phase nicht erlaubt');
  if(s.paused&&a.type!=='RESUME')throw new QuiztafelError('PAUSED','Spiel ist pausiert');
  let next:Session=s;
  switch(a.type){
    case 'START':phase('setup');next={...s,phase:'board'};break;
    case 'PICK':
      phase('board');
      requireRule(s.tiles.some(t=>t.id===a.tileId),'TILE','Unbekanntes Feld');
      requireRule(!s.usedTileIds.includes(a.tileId),'TILE','Feld ist bereits geschlossen');
      next={...s,selectedTileId:a.tileId,phase:'prepared'};break;
    case 'UNPICK':phase('prepared');next={...s,selectedTileId:null,phase:'board'};break;
    case 'PUBLISH':phase('prepared');next={...s,phase:'question'};break;
    case 'PRIMARY':
      phase('question');
      next={...s,primaryResult:a.result,candidate:a.result==='correct'?'selector':null,
        phase:a.result==='correct'?'adjudicated':'steal-offer'};break;
    case 'OFFER_STEAL':phase('steal-offer');next={...s,phase:'steal'};break;
    case 'STEAL':phase('steal');
      next={...s,stealResult:a.result,candidate:a.result==='correct'?'stealer':'none',
        phase:'adjudicated'};break;
    case 'REVEAL':phase('adjudicated');next={...s,phase:'revealed'};break;
    case 'ADJUST':
      phase('revealed');
      requireRule(a.winner!=='selector'||s.primaryResult==='correct'||s.primaryResult==='wrong','RESULT','Kein bewertbarer Erstversuch');
      requireRule(a.winner!=='stealer'||s.stealResult==='correct'||s.stealResult==='wrong','RESULT','Kein bewertbarer Übernahmeversuch');
      next={...s,candidate:a.winner};break;
    case 'CONFIRM':{
      phase('revealed');
      const tile=selectedTile(s);requireRule(tile,'PHASE','Kein offenes Feld');
      requireRule(!s.usedTileIds.includes(tile.id),'REPLAY','Feld wurde bereits gewertet');
      requireRule(s.candidate!==null,'RESULT','Wertung wurde nicht bestätigt');
      const outcome=makeOutcome(s,false);
      next={...s,phase:'awarded',usedTileIds:[...s.usedTileIds,tile.id],
        outcomes:[...s.outcomes.filter(x=>x.tileId!==tile.id),outcome]};break;
    }
    case 'CORRECT':{
      phase('awarded');
      requireRule(!s.annulled,'PHASE','Annullierte und unveröffentlichte Antworten dürfen nicht durch Korrektur offengelegt werden');
      const tile=selectedTile(s);requireRule(tile,'PHASE','Kein Feld für Korrektur');
      next={...s,phase:'revealed',usedTileIds:s.usedTileIds.filter(id=>id!==tile.id),
        outcomes:s.outcomes.filter(o=>o.tileId!==tile.id),annulled:false};break;
    }
    case 'ANNUL':{
      phase('prepared','question','steal-offer','steal','adjudicated','revealed','awarded');
      requireRule(a.reason.trim().length>=3,'REASON','Annullierung erfordert eine Begründung');
      const tile=selectedTile(s);requireRule(tile,'PHASE','Kein aktuelles Feld');
      next={...s,phase:'awarded',usedTileIds:s.usedTileIds.includes(tile.id)?s.usedTileIds:[...s.usedTileIds,tile.id],
        outcomes:[...s.outcomes.filter(o=>o.tileId!==tile.id),{
          tileId:tile.id,selectorId:selector(s).id,
          stealerId:s.primaryResult&&s.primaryResult!=='correct'?eligibleStealer(s).id:null,
          winnerId:null,points:0,annulled:true,
        }],candidate:'none',annulled:true};break;
    }
    case 'NEXT':
      phase('awarded');
      requireRule(s.usedTileIds.length===s.turn+1,'CORRUPT','Spielplan hat unerwartete freie/gespielte Felder');
      next={...s,turn:s.turn+1,phase:s.usedTileIds.length===s.tiles.length?'complete':'board',
        selectedTileId:null,primaryResult:null,stealResult:null,candidate:null,annulled:false};break;
    case 'PAUSE':
      requireRule(s.phase!=='setup'&&s.phase!=='complete','PHASE','Spiel kann hier nicht pausieren');
      next={...s,paused:true};break;
    case 'RESUME':requireRule(s.paused,'PHASE','Spiel ist nicht pausiert');next={...s,paused:false};break;
  }
  return {...next,revision:s.revision+1,audit:[...s.audit,{
    revision:s.revision+1,commandId:c.id,type:a.type,at:c.at,
  }]};
}
export type PublicBoard={
  kind:'board';categories:readonly Category[];rows:number;
  cells:readonly {id:string;categoryId:string;row:number;value:number;closed:boolean}[];
  selectorName:string;turn:number;total:number;
};
export type PublicQuestion={
  kind:'question';category:string;points:number;prompt:string;selectorName:string;
  respondingName:string;steal:boolean;
};
export type PublicAnswer={
  kind:'answer';category:string;points:number;prompt:string;answer:string;
};
export type PublicResult={
  kind:'results';teams:readonly {id:string;name:string;points:number}[];final:boolean;
};
export type PublicScene={kind:'waiting'|'paused'}|PublicBoard|PublicQuestion|PublicAnswer|PublicResult;
export function publicScene(s:Session):PublicScene{
  if(s.paused)return {kind:'paused'};
  if(s.phase==='setup')return {kind:'waiting'};
  if(s.phase==='complete'||s.phase==='awarded'){
    if(s.phase==='complete')return {kind:'results',final:true,teams:
      orderedTeams(s).map(t=>({id:t.id,name:t.name,points:scores(s)[t.id]??0}))};
    return {kind:'board',categories:s.categories,rows:DEPTH[s.profile],
      cells:s.tiles.map(t=>({id:t.id,categoryId:t.categoryId,row:t.row,value:t.value,closed:s.usedTileIds.includes(t.id)})),
      selectorName:eligibleStealer(s).name,
      turn:s.turn+1,total:s.tiles.length};
  }
  if(s.phase==='board'||s.phase==='prepared'){
    return {kind:'board',categories:s.categories,rows:DEPTH[s.profile],
      cells:s.tiles.map(t=>({id:t.id,categoryId:t.categoryId,row:t.row,value:t.value,closed:s.usedTileIds.includes(t.id)})),
      selectorName:selector(s).name,
      turn:s.turn+1,total:s.tiles.length};
  }
  const tile=selectedTile(s);requireRule(tile,'CORRUPT','Aktuelles Feld fehlt');
  const category=s.categories.find(c=>c.id===tile.categoryId);
  requireRule(category,'CORRUPT','Kategorie fehlt');
  if(s.phase==='revealed')return {kind:'answer',category:category.name,points:tile.value,
    prompt:tile.prompt,answer:tile.answer};
  return {kind:'question',category:category.name,points:tile.value,prompt:tile.prompt,
    selectorName:selector(s).name,
    respondingName:s.phase==='steal'?eligibleStealer(s).name:selector(s).name,
    steal:s.phase==='steal'};
}
