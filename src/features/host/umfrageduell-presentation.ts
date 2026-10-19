import type {Survey,Submission,Session} from '../../games/umfrageduell/engine';
import {pointsFor} from '../../games/umfrageduell/engine';

/** A read-only draft estimate using only the authentic Umfrageduell point rules.
 * Invalid/partial responses never receive a fabricated score or certification.
 * No data is stored or published by this display helper.
 */
export type DraftScorePreview={status:'empty'|'incomplete'|'ready';points:number|null};
export function draftScorePreview(task:Survey,draft:Submission):DraftScorePreview{
 const count=task.format==='top3'?3:1;
 if(draft.answers.length!==count||draft.mapped.length!==count)return {status:'incomplete',points:null};
 if(draft.answers.every(v=>!v.trim()))return {status:'empty',points:0};
 if(draft.answers.some(v=>!v.trim()||v.length>300))return {status:'incomplete',points:null};
 try{return {status:'ready',points:pointsFor(task,draft)};}
 catch{return {status:'incomplete',points:null};}
}
export function recordedSurveyProgress(
 teams:readonly Pick<Session['teams'][number],'id'>[],
 submissions:Readonly<Session['submissions']>,
):{recorded:number;total:number}{
 return {recorded:teams.filter(t=>Object.hasOwn(submissions,t.id)).length,total:teams.length};
}
