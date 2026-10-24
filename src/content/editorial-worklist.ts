import type {ContentItem} from './contracts';
import type {SourceReviewTask} from './editorial-source-review';

/** A local-only research worksheet; blank reviewer fields are deliberately not decisions. */
const HEADER=[
 'Aufgaben-ID','Spiel','Lokaler Status','Prüfgruppe','Frage oder Hinweise',
 'Antwort oder illustrative Kategorien','Referenz im Entwurf',
 'Primärquelle als Recherchehinweis','Prüfauftrag zur Quelle',
 'G23-Hinweise','Verwandte Aufgaben','Angegebene Rechte (nicht verifiziert)',
 'Ursprungsdatei','Quellenversion','Antwort geprüft','Beleg geprüft',
 'Rechte geprüft','Spielleitung geprüft','Redaktionelle Entscheidung',
] as const;
const phrase=(x:unknown)=>typeof x==='string'?x:'';
function field(item:ContentItem){
 const p=item.payload as Record<string,unknown>;
 const pieces=[phrase(p.prompt),
  Array.isArray(p.clues)?'Hinweise: '+p.clues.map(phrase).join(' | '):'',
  Array.isArray(p.items)?'Reihe: '+p.items.map(phrase).join(' | '):'',
  Array.isArray(p.tiles)?'Wandfelder: '+p.tiles.map(t=>phrase((t as {label?:unknown}).label)).join(' | '):'',
  phrase(p.hint)?'Zusätzlicher Hinweis: '+phrase(p.hint):'',
  Array.isArray(p.choices)&&p.choices.length?'Antwortoptionen: '+p.choices.map(phrase).join(' | '):'',
 ].filter(Boolean);
 const question=pieces.join(' — ')||phrase(p.target);
 const categoryText=Array.isArray(p.categories)?
  p.categories.map(c=>phrase((c as {label?:unknown}).label)).join(' | '):'';
 const source=(p.source as {kind?:string;source?:string;population?:string;
  method?:string;collectedOn?:string;limitations?:string}|undefined);
 const answer=[
  phrase(p.answer)||phrase(p.target)||
   (source?.kind==='illustrative'?'Illustrative Kategorien, keine Umfrage: '+categoryText:categoryText)||
   (Array.isArray(p.groups)?p.groups.map(g=>phrase((g as {link?:unknown}).link)).join(' | '):''),
  p.truth!==undefined?'Wahrheitswert: '+String(p.truth):'',
  phrase(p.explanation)?'Erklärung: '+phrase(p.explanation):'',
 ].filter(Boolean).join(' — ');
 const sourceLabel=source?.kind==='illustrative'?'Nur illustrativ, nicht erhoben':
  source?.kind==='observed'?
   ['Beobachtete Umfrage – unabhängig prüfen',phrase(source.source),phrase(source.population),
    phrase(source.method),phrase(source.collectedOn),phrase(source.limitations)].filter(Boolean).join(' | '):'';
 return {question,answer,reference:phrase(p.reference)||sourceLabel};
}
/** Quoted CSV with spreadsheet formula neutralization, even after leading whitespace. */
export function worksheetCell(input:string):string{
 const safe=/^[\s\uFEFF]*[=+\-@]/u.test(input)?"'"+input:input;
 return '"'+safe.replace(/"/g,'""')+'"';
}
/**
 * Explicit local download only. This contains raw question/answer material;
 * never upload, publish, authorize, or interpret blank review cells as approval.
 */
export function exportReviewWorksheet(tasks:readonly SourceReviewTask[]):string{
 const lines=[HEADER.map(worksheetCell).join(',')];
 for(const task of tasks){
  const {item,lead,issues,route}=task,p=field(item);
  const related=[...new Set(issues.map(x=>x.other).filter((x):x is string=>!!x))].sort();
  const row=[
   item.id,item.game,item.status,route,p.question,p.answer,p.reference,
   lead?.url??'',lead?.comparison??'',
   issues.map(x=>x.severity.toUpperCase()+': '+x.code).join(' | '),
   related.join(' | '),item.provenance.rights??'',
   item.provenance.sourceKey??'',item.provenance.sourceVersion??'',
   '','','','','',
  ];
  lines.push(row.map(worksheetCell).join(','));
 }
 return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
