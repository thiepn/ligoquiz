import type {EventRecord} from '../../domain/event/schemas';
import {scores as rundenquizScores} from '../../games/rundenquiz/engine';
import {scores as quiztafelScores} from '../../games/quiztafel/engine';
import {scores as verbindungenScores} from '../../games/verbindungen/engine';
import {scores as logikleiterScores} from '../../games/logikleiter/engine';
import {scores as umfrageduellScores} from '../../games/umfrageduell/engine';

export type ReviewTeam={id:string;name:string;points:number;total:number};
export type ReviewTask={
 id:string;number:number;type:string;prompt:string;answer:string;
 evidence:readonly string[];source:string;annulled:boolean;teams:readonly ReviewTeam[];
};
export type RoundReview={
 eventId:string;game:string;sourceNotice:string;teams:readonly {id:string;name:string}[];
 tasks:readonly ReviewTask[];
};

type OriginalAward={teamId:string;points:number;annulled?:boolean};
type TaskSeed={id:string;type:string;prompt:string;answer:string;evidence:string[];
 source:string;awards:OriginalAward[];expectedTeams:readonly string[]};

/** The finished archive is the ONLY surface allowed to create a debrief.
 * No stage DTO, active event, guessed award, or new scoring calculation is used. */
export function completedRoundReview(event:EventRecord):RoundReview|null{
 if(event.lifecycle!=='complete'||event.recoveryRequired)return null;
 const teams=[...event.teams].sort((a,b)=>a.order-b.order).map(t=>({id:t.id,name:t.name}));
 const every=teams.map(t=>t.id);
 let seeds:TaskSeed[]=[];
 let original:Record<string,number>;
 let game:string;
 let sourceNotice:string;
 if(event.rundenquiz){
  const s=event.rundenquiz;
  if(s.phase!=='complete')return null;
  game='Rundenquiz';sourceNotice='Originale Aufgabenquellen; Probeinhalte ggf. noch ungeprüft.';
  original=rundenquizScores(s);
  seeds=s.questions.map(q=>({
   id:q.id,type:({wissen:'Wissen',hinweise:'Vier Hinweise',schaetzen:'Schätzen',finale:'Finale'} as const)[q.round],
   prompt:q.prompt,answer:q.answer,evidence:[
    ...(q.choices?.length?['Antwortmöglichkeiten: '+q.choices.join(' · ')]:[]),
    ...(q.clues?.length?['Hinweise: '+q.clues.join(' · ')]:[]),
    ...(q.round==='schaetzen'&&q.unit?['Einheit: '+q.unit]:[]),
   ],source:q.reference,awards:s.awards.filter(a=>a.questionId===q.id),
   expectedTeams:every,
  }));
 }else if(event.quiztafel){
  const s=event.quiztafel;
  if(s.phase!=='complete')return null;
  game='Quiztafel';sourceNotice='Originale Feldquellen; Probeinhalte ggf. noch ungeprüft.';
  original=quiztafelScores(s);
  // Pick order, not editorial category order: the actual canonical competition sequence.
  seeds=s.outcomes.map(outcome=>{
   const tile=s.tiles.find(t=>t.id===outcome.tileId);
   if(!tile)return null;
   const category=s.categories.find(c=>c.id===tile.categoryId)?.name;
   if(!category)return null;
   const winner=outcome.winnerId?teams.find(t=>t.id===outcome.winnerId):null;
   return {
    id:tile.id,type:category+' · '+tile.value, prompt:tile.prompt,answer:tile.answer,
    evidence:['Auswahl: '+(teams.find(t=>t.id===outcome.selectorId)?.name??'Unbekannt'),
     ...(outcome.stealerId?['Übernahme: '+(teams.find(t=>t.id===outcome.stealerId)?.name??'Unbekannt')]:[]),
     'Wertung: '+(outcome.annulled?'Annulliert':winner?.name??'Keine Punkte')],
    source:tile.reference,
    awards:winner?[{teamId:winner.id,points:outcome.points,annulled:false}]:[],
    expectedTeams:winner?[winner.id]:[],
    ...(outcome.annulled?{annulled:true}:{}),
   };
  }).filter((x):x is NonNullable<typeof x>=>x!==null);
  if(seeds.length!==s.outcomes.length||s.outcomes.length!==s.tiles.length)return null;
 }else if(event.verbindungen){
  const s=event.verbindungen;
  if(s.phase!=='complete')return null;
  game='Verbindungen';sourceNotice='Originale Aufgabenquellen; Probeinhalte ggf. noch ungeprüft.';
  original=verbindungenScores(s);
  seeds=s.assignments.map(assignment=>{
   const puzzle=s.puzzles.find(p=>p.id===assignment.puzzleId);
   if(!puzzle)return null;
   const taskAwards=s.awards.filter(a=>a.puzzleId===puzzle.id);
   const targetTeam=assignment.teamId?teams.find(t=>t.id===assignment.teamId):null;
   return {
    id:puzzle.id,type:puzzle.kind==='clues'?'Vier Hinweise':puzzle.kind==='sequence'?'Folge ergänzen':'Verbindungswand',
    prompt:puzzle.kind==='clues'?'Welche Person ist gesucht?':
     puzzle.kind==='sequence'?puzzle.prompt:'Welche vier Gruppen gehören zusammen?',
    answer:puzzle.kind==='clues'?puzzle.target:
     puzzle.kind==='sequence'?puzzle.answer:
     puzzle.groups.map(g=>g.link+': '+g.tileIds.map(id=>puzzle.tiles.find(t=>t.id===id)?.label??id).join(', ')).join(' | '),
    evidence:puzzle.kind==='clues'?[...puzzle.clues]:
     puzzle.kind==='sequence'?[...puzzle.items,puzzle.explanation]:
     puzzle.groups.map(g=>g.link+' · '+g.acceptedLinks.join(' / ')),
    source:puzzle.reference,
    awards:taskAwards,expectedTeams:targetTeam?[targetTeam.id]:every,
    ...(taskAwards.length>0&&taskAwards.every(a=>a.annulled)?{annulled:true}:{}),
   };
  }).filter((x):x is NonNullable<typeof x>=>x!==null);
  if(seeds.length!==s.assignments.length)return null;
 }else if(event.logikleiter){
  const s=event.logikleiter;
  if(s.phase!=='complete')return null;
  game='Logikleiter';sourceNotice='Originale Rätselquellen; Probeinhalte ggf. noch ungeprüft.';
  original=logikleiterScores(s);
  seeds=s.rungs.map(r=>({
   id:r.id,type:'Stufe '+r.difficulty, prompt:r.prompt,answer:r.answer,
   evidence:[r.explanation,'Hinweis: '+r.hint],source:r.reference,
   awards:s.awards.filter(a=>a.rungId===r.id),expectedTeams:every,
  }));
 }else if(event.umfrageduell){
  const s=event.umfrageduell;
  if(s.phase!=='complete')return null;
  game='Umfrageduell';sourceNotice='Rangplätze und Teamwertungen aus der Originalsession.';
  original=umfrageduellScores(s);
  seeds=s.surveys.map(survey=>({
   id:survey.id,type:survey.format==='popular'?'Beliebteste Antwort':'Top 3',
   prompt:survey.prompt,answer:survey.categories.map((c,i)=>(i+1)+'. '+c.label).join(' · '),
   evidence:survey.source.kind==='illustrative'?['BEISPIELDATEN – keine echte Umfrage']:
    ['Population: '+survey.source.population,'Erhebung: '+survey.source.method,
      'Datum: '+survey.source.collectedOn,'Einschränkungen: '+survey.source.limitations],
   source:survey.source.kind==='illustrative'?'Redaktionell erdachte Beispielreihenfolge':survey.source.source,
   awards:s.awards.filter(a=>a.surveyId===survey.id),expectedTeams:every,
  }));
 }else return null;
 if(!seeds.length || seeds.some(seed=>!seed.id||!seed.source||!seed.answer))return null;
 if(new Set(seeds.map(s=>s.id)).size!==seeds.length)return null;
 const accumulated:Record<string,number>=Object.fromEntries(every.map(id=>[id,0]));
 const tasks:ReviewTask[]=[];
 for(const seed of seeds){
  // No silently recomputed or fabricated award; each expected original receipt must exist exactly once.
  const unique=new Set<string>();
  for(const award of seed.awards){
   if(!every.includes(award.teamId)||unique.has(award.teamId)||!Number.isFinite(award.points))return null;
   unique.add(award.teamId);
  }
  if(!seed.expectedTeams.every(id=>unique.has(id))||seed.awards.length!==seed.expectedTeams.length)return null;
  const deltas=Object.fromEntries(seed.awards.map(a=>[a.teamId,a.points]));
  for(const team of teams)accumulated[team.id]=(accumulated[team.id]??0)+(deltas[team.id]??0);
  tasks.push({id:seed.id,number:tasks.length+1,type:seed.type,prompt:seed.prompt,
    answer:seed.answer,evidence:seed.evidence,source:seed.source,
    annulled:('annulled' in seed&&Boolean(seed.annulled))||
      (seed.awards.length>0&&seed.awards.every(a=>a.annulled)),
    teams:teams.map(t=>({id:t.id,name:t.name,points:deltas[t.id]??0,total:accumulated[t.id]??0})),
  });
 }
 if(teams.some(t=>accumulated[t.id]!==original[t.id]))return null;
 return {eventId:event.id,game,sourceNotice,teams,tasks};
}
