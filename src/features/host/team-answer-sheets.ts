import type {EventRecord} from '../../domain/event/schemas';

export type AnswerSheetTask={number:number;group:string;label:string};
export type AnswerSheetTeam={id:string;name:string};
export type AnswerSheetPlan={
 game:string;eventId:string;teams:readonly AnswerSheetTeam[];tasks:readonly AnswerSheetTask[];
};
const roundup:Readonly<Record<string,string>>={
 wissen:'Wissen',hinweise:'Vier Hinweise',schaetzen:'Schätzen',finale:'Finale',
};
const puzzle:Readonly<Record<string,string>>={
 clues:'Vier Hinweise',sequence:'Folge ergänzen',wall:'Verbindungswand',
};
const say=(v:string):string=>Array.from(v,ch=>{const code=ch.charCodeAt(0);
 return code<32||code>=127&&code<=159?' ':ch;
}).join('').trim();
/** Read-only original session skeleton; deliberately NEVER inspects frozenTasks/answers. */
export function originalAnswerSheetPlan(event:EventRecord):AnswerSheetPlan|null{
 if(event.lifecycle==='complete'||event.lifecycle==='abandoned'||event.recoveryRequired)return null;
 const teams=[...event.teams].sort((a,b)=>a.order-b.order).map(t=>({id:t.id,name:say(t.name)}));
 if(teams.length<3||teams.length>5||teams.some(t=>!t.id||!t.name)||
    new Set(teams.map(t=>t.id)).size!==teams.length)return null;
 let game='',groups:string[]=[];
 if(event.rundenquiz){
  game='Rundenquiz';groups=event.rundenquiz.questions.map(q=>roundup[q.round]??'Aufgabe');
 }else if(event.quiztafel){
  game='Quiztafel';groups=event.quiztafel.tiles.map(()=>'Feldwahl');
 }else if(event.verbindungen){
  game='Verbindungen';groups=event.verbindungen.assignments.map(a=>puzzle[a.kind]??'Aufgabe');
 }else if(event.logikleiter){
  game='Logikleiter';groups=event.logikleiter.rungs.map(()=>'Stufe');
 }else if(event.umfrageduell){
  game='Umfrageduell';groups=event.umfrageduell.surveys.map(()=>'Umfrage');
 }else return null;
 if(!groups.length||groups.length>40)return null;
 const tasks=groups.map((group,i)=>({number:i+1,group,label:group==='Feldwahl'?'Spielzug '+(i+1):
  group==='Stufe'?'Stufe '+(i+1):group==='Umfrage'?'Umfrage '+(i+1):
  group==='Verbindungswand'?'Gemeinsame Wand':group+' · '+(i+1)}));
 return {eventId:event.id,game,teams,tasks};
}
const safeHtml=(value:string):string=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export type PrintSheetOptions={teamId:'all'|string;answerLines:2|3|4};
export function printableTeamSheets(plan:AnswerSheetPlan,options:PrintSheetOptions):string{
 if(![2,3,4].includes(options.answerLines)||
   (options.teamId!=='all'&&!plan.teams.some(t=>t.id===options.teamId)))
  throw Error('Ungültige Druckauswahl');
 const selected=options.teamId==='all'?plan.teams:plan.teams.filter(t=>t.id===options.teamId);
 const sheets=selected.map((team,index)=>{
  const pages:AnswerSheetTask[][]=[];
  // Bound one real A4 page per group, without clipping long profiles.
  const perPage=options.answerLines===4?7:options.answerLines===3?9:12;
  for(let i=0;i<plan.tasks.length;i+=perPage)pages.push(plan.tasks.slice(i,i+perPage));
  return pages.map((tasks,pageIndex)=>'<section class="sheet" aria-label="Antwortbogen '+safeHtml(team.name)+'">'+
   '<header><strong>LiGoQuiz<span>!</span></strong><div class="team">TEAM '+safeHtml(team.name)+'</div>'+
   '<p>'+safeHtml(plan.game)+' · Seite '+(pageIndex+1)+' von '+pages.length+'</p></header>'+
   '<main>'+tasks.map(task=>'<div class="task"><div class="task-head"><b>'+task.number.toString().padStart(2,'0')+
    '</b><span>'+safeHtml(task.label)+'</span></div><div class="lines">'+
    Array.from({length:options.answerLines},()=>'<div class="line"></div>').join('')+'</div></div>').join('')+
   '</main><footer><span>'+safeHtml(team.name)+'</span><span>'+plan.tasks.length+' Aufgaben · Blatt '+
    (index+1)+' von '+selected.length+'</span></footer></section>').join('');
 }).join('');
 return '<!doctype html><html lang="de"><head><meta charset="utf-8">'+
  '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; script-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>LiGoQuiz · Antwortbögen</title>'+
  '<style>*{box-sizing:border-box}body{margin:0;background:#e6eaf2;color:#182b4d;font:500 15px/1.35 system-ui,sans-serif}'+
  '.print-actions{display:flex;gap:16px;align-items:center;justify-content:center;padding:16px;background:#172b58;color:white}'+
  '.print-actions button{font:800 17px system-ui;min-height:48px;border:0;background:#ffe35a;color:#132851;padding:10px 22px;cursor:pointer}'+
  '.sheet{background:white;width:210mm;min-height:297mm;margin:16px auto;padding:15mm 15mm 13mm;display:flex;flex-direction:column;break-after:page;page-break-after:always;box-shadow:0 2px 15px #9cabbb}'+
  '.sheet:last-child{break-after:auto;page-break-after:auto}header{border-bottom:3px solid #172e64;padding-bottom:9mm}header>strong{font:900 25px system-ui;letter-spacing:-1px}header>strong span{color:#224ee5}'+
  '.team{font:900 30px/1.15 system-ui;overflow-wrap:anywhere;margin-top:5mm}header p{font-weight:800;margin:4mm 0 0}main{flex:1;display:grid;align-content:start;gap:6mm;padding-top:8mm}'+
  '.task-head{display:flex;align-items:baseline;gap:12px;font-size:15px;font-weight:850}.task-head b{font-size:19px;color:#2751bf}'+
  '.lines{margin-left:37px;display:grid;gap:4mm}.line{height:4mm;border-bottom:1px solid #a3b1ca}'+
  'footer{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #b9c6d8;padding-top:5mm;font-size:12px;font-weight:750}'+
  'button:focus-visible{outline:3px solid #fcaf20;outline-offset:3px}'+
  '@page{size:A4;margin:0} @media print{body{background:white}.print-actions{display:none}.sheet{width:210mm;min-height:297mm;margin:0;box-shadow:none}}'+
  '@media(max-width:820px){.sheet{max-width:100%;width:auto;min-height:0;margin:10px;padding:20px}.print-actions{flex-wrap:wrap}.team{font-size:25px}}'+
  '</style></head><body><div class="print-actions"><span>Antwortbögen · '+selected.length+
  ' Teams</span><button id="print" type="button">Antwortbögen drucken</button></div>'+sheets+
  '<script>document.getElementById("print").addEventListener("click",function(){window.print()});</script>'+
  '</body></html>';
}
