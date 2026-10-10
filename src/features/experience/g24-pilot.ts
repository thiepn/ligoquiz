import {CHECKS,SCENARIOS,blankTrialRow,canonicalTrial,reconcileTrial,sealTrial,
 type TrialRow,type ScenarioKey} from './event-trial';

export const G24_DRAFT_KEY='ligoquiz.v2.g24.local-pilot-draft.v1' as const;
const MAX_DRAFT_BYTES=256*1024;
const MAX_DRAFT_AGE_DAYS=30;
const enc=new TextEncoder();
const isObject=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);

export type PilotDraft={format:'ligoquiz-g24-local-draft-v1';savedAt:number;envelope:Awaited<ReturnType<typeof sealTrial>>};
export type PilotDraftCandidate={savedAt:number;report:Awaited<ReturnType<typeof reconcileTrial>>};

/**
 * An explicit, same-tab browser-session recovery aid, NOT real physical acceptance.
 * Fail closed on corrupt/oversized data; never delete unknown, G18, or legacy keys.
 */
export async function readPilotDraft(storage:Pick<Storage,'getItem'>,now=Date.now()):Promise<PilotDraftCandidate|null>{
 const raw=storage.getItem(G24_DRAFT_KEY);
 if(raw===null)return null;
 if(enc.encode(raw).byteLength>MAX_DRAFT_BYTES)throw Error('Lokaler G24-Entwurf zu groß; nicht übernommen');
 let value:unknown;
 try{value=JSON.parse(raw)}catch{throw Error('Lokaler G24-Entwurf beschädigt; unverändert belassen');}
 if(!isObject(value)||Object.keys(value).sort().join('|')!=='envelope|format|savedAt'||
  value.format!=='ligoquiz-g24-local-draft-v1'||!Number.isSafeInteger(value.savedAt)||
  (value.savedAt as number)>now+60_000||now-(value.savedAt as number)>MAX_DRAFT_AGE_DAYS*86400_000)
  throw Error('Lokaler G24-Entwurf ist nicht gültig oder zu alt');
 const report=await reconcileTrial(value.envelope);
 return {savedAt:value.savedAt as number,report};
}
export async function serializePilotDraft(records:Readonly<Record<string,TrialRow>>,
 notes:string,at=Date.now()):Promise<string>{
 const envelope=await sealTrial(records,notes);
 const packet:PilotDraft={format:'ligoquiz-g24-local-draft-v1',savedAt:at,envelope};
 const json=JSON.stringify(packet);
 if(enc.encode(json).byteLength>MAX_DRAFT_BYTES)throw Error('Lokaler Entwurf größer als 256 KiB');
 return json;
}
export async function savePilotDraft(storage:Pick<Storage,'setItem'>,
 records:Readonly<Record<string,TrialRow>>,notes:string,at=Date.now()):Promise<number>{
 const json=await serializePilotDraft(records,notes,at);
 storage.setItem(G24_DRAFT_KEY,json);
 return json.length;
}
export function clearPilotDraft(storage:Pick<Storage,'removeItem'>):void{
 storage.removeItem(G24_DRAFT_KEY);
}
export type PilotStatus='open'|'partial'|'reported'|'defect';
export function pilotRowStatus(row:TrialRow):PilotStatus{
 if(CHECKS.some(c=>row.checks[c.id]==='defect'))return 'defect';
 const found=CHECKS.filter(c=>row.checks[c.id]==='reported').length;
 return found===CHECKS.length?'reported':found>0?'partial':'open';
}
export function pilotSummary(input:Readonly<Record<string,TrialRow>>){
 const rows=canonicalTrial(input).rows;
 const counts={open:0,partial:0,reported:0,defect:0};
 rows.forEach(row=>{counts[pilotRowStatus(row)]++;});
 return counts;
}
export type PilotFilter='all'|'attention'|'defect'|'reported';
export function pilotVisible(input:Readonly<Record<string,TrialRow>>,
 options:{filter?:PilotFilter;game?:string;teams?:number}={}){
 return SCENARIOS.filter(s=>{
  if(options.game&&options.game!=='all'&&s.game!==options.game)return false;
  if(options.teams&&s.teams!==options.teams)return false;
  const status=pilotRowStatus(input[s.id]??blankTrialRow(s.id));
  return !options.filter||options.filter==='all'||
   (options.filter==='attention'&&status!=='reported')||
   (options.filter==='defect'&&status==='defect')||
   (options.filter==='reported'&&status==='reported');
 });
}
export function nextPilotScenario(current:string,input:Readonly<Record<string,TrialRow>>,
 filter:PilotFilter='attention'):ScenarioKey|null{
 const candidates=pilotVisible(input,{filter});
 if(candidates.length===0)return null;
 const index=SCENARIOS.findIndex(s=>s.id===current);
 return candidates.find(s=>SCENARIOS.findIndex(k=>k.id===s.id)>index)?.id??candidates[0]!.id;
}

const CUES:Record<string,{opening:string;scoring:string;failure:string}>={
 rundenquiz:{
  opening:'Einmal kurz durch die Fragen gehen: privat Antwort prüfen, dann Frage an alle Teams sichtbar freigeben.',
  scoring:'Für jedes Team eine Antwortentscheidung treffen, Punkte vor der Bestätigung laut abgleichen.',
  failure:'Host bei laufender Antwortphase schließen; Beamer muss pausieren, dann Stand vor Freigabe abgleichen.'},
 quiztafel:{
  opening:'3/4/5-Teams-Tafel prüfen, ein freies Feld wählen, Antwort vor dem Reveal ausschließlich im Host lassen.',
  scoring:'Erstantwort und eventuelle Übernahme nacheinander entscheiden; Punkte erst nach Sichtkontrolle verbuchen.',
  failure:'Während Feldwahl und Übernahme neu laden; bereits abgefragtes Feld darf nicht erneut frei erscheinen.'},
 verbindungen:{
  opening:'Hinweise, Sequenz und Wand nacheinander durchspielen; geschützte Lösungen vorher nicht projizieren.',
  scoring:'Abgegebene Teamantwort und Punkte jedes Puzzles kontrollieren, dann bestätigen.',
  failure:'Bei teilweise offener Wand unterbrechen; Gruppen und bereits gegebene Antworten vor Fortsetzung abgleichen.'},
 logikleiter:{
  opening:'Rätselstufe, Hinweis und Antwort getrennt vorführen; exakt denselben Schwierigkeitsverlauf prüfen.',
  scoring:'Stufen- und Teamwertung nachvollziehen; eine begründete Korrektur ohne Doppelverbuchung prüfen.',
  failure:'Nach Absturz eine zuvor gewertete Leiterstufe nur kontrolliert fortsetzen; Revision gegen erneute Wertung sichern.'},
 umfrageduell:{
  opening:'Illustrative Umfrage-Ergebnisse als Spielwerte kennzeichnen; Antworten im Host vor Reveal geheim halten.',
  scoring:'Jede akzeptierte Variante und Rundensumme prüfen; Publikum erst nach Freigabe informieren.',
  failure:'Während gestoppter Aufdeckung neuladen; zuvor vergebene Punkte und Enthüllungsschutz überprüfen.'},
};
export function pilotCue(id:ScenarioKey){
 const scenario=SCENARIOS.find(s=>s.id===id);
 if(!scenario)throw Error('Unbekannte Probe');
 return {...CUES[scenario.game]!,label:scenario.label,teams:scenario.teams};
}
/** No evidence bytes or player answers; a planning card is NEVER a review receipt. */
export function pilotCard(id:ScenarioKey,existing:TrialRow|null=null):string{
 const s=SCENARIOS.find(v=>v.id===id);if(!s)throw Error('Unbekanntes Szenario');
 const c=pilotCue(id);
 const checks=existing?.checks??blankTrialRow(id).checks;
 return [
  'LiGoQuiz — G24 OPERATOR-LAUFKARTE (PLANUNG / KEINE ABNAHME)',
  s.label+' · '+s.teams+' Teams',
  '',
  '1. START — '+c.opening,
  '2. WERTUNG — '+c.scoring,
  '3. STÖRUNG / RECOVERY — '+c.failure,
  '',
  'Pflichtprüfpunkte (selbst notierte Status, keine Freigaben):',
  ...CHECKS.map((check,i)=>`${i+1}. [${checks[check.id]}] ${check.title} — ${check.instruction}`),
  '',
  'Ablauf: #/setup -> #/host -> #/technik -> #/einstellungen.',
  'Beamer: echte Publikumsdistanz; private Antworten müssen vor Aufdeckung verborgen bleiben.',
  'Lizenz-, Gerätetest-, Wiederherstellungs- und Eigentümerfreigaben bleiben unabhängig OFFEN.',
  'NO_GO / nicht signiert / keine Abnahme / kein Beweis einer physischen Durchführung',
 ].join('\n');
}
