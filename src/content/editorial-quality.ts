import {normalizedKey,type ContentItem} from './contracts';
import type {AuditIssue} from './editorial-audit';
import {originalWordingRisk} from './editorial-source-review';
export type QualitySignal={
 code:'CITATION_PINPOINT'|'CLUE_REPEAT'|'ANSWER_LEAK'|'EXPLANATION_UNCLEAR'|
 'ILLUSTRATIVE_ONLY'|'CROSS_GAME_REVEAL'|'DUPLICATE_SOURCE'|'ORIGINAL_WORDING_RISK';
 message:string;relatedId?:string;
};
/** Original payload checks are editorial triage, not fact, grading or rights approval. */
export function qualitySignals(item:ContentItem,issues:readonly AuditIssue[]=[]):QualitySignal[]{
 if(item.status==='quarantined')return [];
 const p=item.payload as Record<string,unknown>,result:QualitySignal[]=[];
 const add=(code:QualitySignal['code'],message:string,relatedId?:string)=>{
  if(!result.some(x=>x.code===code&&x.relatedId===relatedId))
   result.push({code,message,...(relatedId?{relatedId}:{})});
 };
 const reference=typeof p.reference==='string'?p.reference.trim():'';
 if(item.game!=='umfrageduell'&&reference&&
  !/https:\/\/[^\s;]+/iu.test(reference)&&
  !/\b\d{1,3}\s*[,.:]\s*\d{1,3}/u.test(reference)&&
  !/\b(?:Art\.|§)\s*\d+/iu.test(reference))
  add('CITATION_PINPOINT','Originalquelle benötigt eine genaue Belegstelle oder direktes Dokument');
 const originalRisk=originalWordingRisk(item);
 if(originalRisk)add('ORIGINAL_WORDING_RISK',originalRisk.problem);
 if(item.game==='umfrageduell'&&(p.source as {kind?:string}|undefined)?.kind==='illustrative')
  add('ILLUSTRATIVE_ONLY','Frei erfundene Beispielrangfolge; keine erhobene Umfrage');
 const answer=typeof p.answer==='string'?p.answer:typeof p.target==='string'?p.target:'';
 const normalizedAnswer=normalizedKey(answer);
 const clues=Array.isArray(p.clues)?p.clues.filter((s):s is string=>typeof s==='string'):[];
 const seen=new Set<string>();
 for(const clue of clues){
  const text=normalizedKey(clue);
  if(seen.has(text))add('CLUE_REPEAT','Gleicher Hinweis mehrfach in gestaffelter Aufgabe');
  seen.add(text);
  if(normalizedAnswer.length>=5&&text.includes(normalizedAnswer))
   add('ANSWER_LEAK','Lösung erscheint im Hinweis; gestaffelte Fairness prüfen');
 }
 if(item.game==='logikleiter'&&typeof p.explanation==='string'&&p.explanation.trim().length<25)
  add('EXPLANATION_UNCLEAR','Begründung auf Eindeutigkeit und Nachvollziehbarkeit prüfen');
 for(const issue of issues){
  if(issue.code==='CROSS_GAME_CLUE_REUSE')
   add('CROSS_GAME_REVEAL','Gleiches Hinweisziel in zwei Spielen; Reihenfolge und Hinweise prüfen',issue.other);
  if(issue.code==='EXACT_DUPLICATE'||issue.code==='POSSIBLE_DUPLICATE')
   add('DUPLICATE_SOURCE','Wiederholte Originalfrage vor Spieleinsatz abgleichen',issue.other);
 }
 return result;
}
