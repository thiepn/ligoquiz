import {PROFILE_COUNTS,ROUNDS,type Profile,type Question} from '../../games/rundenquiz/engine';
import {selectReviewedPack,type ContentItem,validatePayload} from '../../content/contracts';
import {sha256} from '../../content/migration';

export type RundenquizChoice={id:string;round:Question['round'];prompt:string};
export type RundenquizLineup={questions:readonly RundenquizChoice[];excluded:number};
/** An approved payload must match the exact original editorial digest before appearing as selectable. */
export async function reviewedRundenquizChoices(items:readonly ContentItem[]):Promise<RundenquizLineup>{
 const questions:RundenquizChoice[]=[];let excluded=0;
 for(const item of items){
  if(item.game!=='rundenquiz')continue;
  if(item.status!=='approved'||!item.review||validatePayload('rundenquiz',item.payload).length){
   excluded++;continue;
  }
  if(await sha256(JSON.stringify(item.payload))!==item.review.fingerprint){excluded++;continue;}
  const q=item.payload as Question;
  if(item.id!==q.id){excluded++;continue;}
  questions.push({id:q.id,round:q.round,prompt:q.prompt});
 }
 return {questions,excluded};
}
export function chosenRundenquizCounts(profile:Profile,choices:readonly RundenquizChoice[],ids:readonly string[]){
 const selected=choices.filter(q=>ids.includes(q.id));
 const counts=PROFILE_COUNTS[profile];
 const details=ROUNDS.map(round=>({round,needed:counts[round],selected:selected.filter(q=>q.round===round).length,
  available:choices.filter(q=>q.round===round).length}));
 const exact=ids.length===selected.length&&new Set(ids).size===ids.length&&
  details.every(d=>d.selected===d.needed);
 return {details,exact};
}
/** Reuse the canonical selector, insist on the precise user chosen task IDs, and never supplement a short pack. */
export function selectedReviewedRundenquizPack(items:readonly ContentItem[],profile:Profile,
 ids:readonly string[]):Question[]{
 if(ids.length===0||ids.length>16||new Set(ids).size!==ids.length)throw Error('Ungültige Fragenauswahl');
 const order=new Map(ids.map((id,i)=>[id,i]));
 const only=items.filter(item=>order.has(item.id)&&item.game==='rundenquiz'&&item.status==='approved')
  .sort((a,b)=>(order.get(a.id)??0)-(order.get(b.id)??0));
 if(only.length!==ids.length)throw Error('Ausgewählte Frage nicht mehr freigegeben');
 const bank=selectReviewedPack(only,'rundenquiz',profile,3);
 if(bank.length!==ids.length||bank.some(q=>!order.has(q.id)))
  throw Error('Auswahl entspricht nicht dem Original-Rundenprofil');
 return bank;
}
