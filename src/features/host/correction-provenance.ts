import type {EventRecord} from '../../domain/event/schemas';

/** Strictly host-local summaries of existing event-sourced audit entries; never replays commands. */
export type GameMode='rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell';
export type AuditView={mode:GameMode;engineRevision:number;eventRevision:number;hostEpoch:number;
 actionCount:number;corrections:number;commits:number;anomalies:readonly string[];
 recent:readonly {revision:number;action:string;at:number;category:'correction'|'commit'|'release'|'moderation'}[];
 sourceEvidence:{frozen:number;hashed:number}};
const corrections=new Set(['CORRECT','ANNUL','ADJUST','FAIR_HINT']);
const commits=new Set(['CONFIRM','RECORD']);
const releases=new Set(['PUBLISH','REVEAL','REVEAL_WALL_GROUP','HINT','NEXT_CLUE']);
const labels:Record<string,string>={
 START:'Spielstart bestätigt',PUBLISH:'Aufgabe öffentlich geschaltet',CLOSE:'Antwortphase geschlossen',
 REVEAL:'Lösung bewusst freigegeben',REVEAL_WALL_GROUP:'Verbindungsgruppe freigegeben',
 CONFIRM:'Wertung verbindlich bestätigt',CORRECT:'Wertungskorrektur',ANNUL:'Aufgabe annulliert',
 ADJUST:'Wertungskandidat geändert',FAIR_HINT:'Hinweis fair korrigiert',
 GRADE:'Teambewertung',JUDGE:'Antwort bewertet',RECORD:'Teamantwort erfasst',
 MARK_GROUP:'Vierergruppe bewertet',MARK_LINK:'Verbindung bewertet',
 PAUSE:'Spielleitung pausiert',RESUME:'Spielleitung ausdrücklich fortgesetzt',
 NEXT:'Nächste Aufgabe',PICK:'Feld gewählt',PRIMARY:'Erstantwort bewertet',
 STEAL:'Übernahme bewertet',HINT:'Hinweis veröffentlicht',NEXT_CLUE:'Hinweis veröffentlicht',
 LOCK:'Abgabe gesperrt',LOCK_HINT:'Antwort erfasst',ESTIMATE:'Schätzung erfasst',
 CLOSE_WALL:'Verbindungswand geschlossen',FINISH:'Abend abgeschlossen'
};
type AuditEntry={revision:number;commandId:string;action?:string;type?:string;at?:number;issuedAt?:number};
export function auditView(event:EventRecord):AuditView|null{
 const modes:GameMode[]=['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'];
 const active=modes.filter(mode=>Boolean(event[mode]));
 if(active.length!==1)return null;
 const mode=active[0]!,state=event[mode]!;
 const audit=state.audit as readonly AuditEntry[],anomalies:string[]=[];
 let previous=0;
 const commands=new Set<string>();
 const rows=audit.map(entry=>{
  const action=entry.action??entry.type??'UNKNOWN';
  if(!Number.isSafeInteger(entry.revision)||entry.revision<=previous)
   anomalies.push('Nicht aufsteigende Aktionrevision');
  previous=entry.revision;
  if(commands.has(entry.commandId))anomalies.push('Doppelter Befehlsnachweis');
  commands.add(entry.commandId);
  const at=entry.at??entry.issuedAt??0;
  if(!Number.isSafeInteger(at)||at<0)anomalies.push('Ungültige Aktionszeit');
  return {revision:entry.revision,action:labels[action]??'Andere Spielaktion',
    at,category:(corrections.has(action)?'correction':commits.has(action)?'commit':
     releases.has(action)?'release':'moderation') as AuditView['recent'][number]['category']};
 });
 if(previous!==state.revision)anomalies.push('Letzte Aktionsrevision und Motorrevision unterscheiden sich');
 if(state.epoch!==event.hostEpoch||state.ownerId!==event.hostId)
  anomalies.push('Spielleitungs- oder Epochengrenze unklar');
 return {mode,engineRevision:state.revision,eventRevision:event.revision,hostEpoch:event.hostEpoch,
  actionCount:audit.length,corrections:rows.filter(r=>r.category==='correction').length,
  commits:rows.filter(r=>r.category==='commit').length,anomalies,
  recent:rows.slice(-12).reverse(),sourceEvidence:{frozen:event.frozenTasks.length,
   hashed:event.frozenTasks.filter(task=>Boolean(task.sourceHash)).length}};
}
/** UI recovery only offers navigation or explicit reload; never blind resubmission. */
export type RecoveryAdvice={type:'stale'|'revoked'|'recovery'|'offline'|'unknown';title:string;next:string;reload:boolean};
export function recoveryAdvice(error:string):RecoveryAdvice{
 const e=error.toLowerCase();
 if(/stale.host|andere spielleitung|übernommen|falsche host|host-berechtigung|hostrechte/.test(e))
  return {type:'revoked',title:'Spielleitung gewechselt',
   next:'Keine Wertung erneut senden. Zur Spielübersicht wechseln; Übernahme nur über den vorgesehenen Weg.',reload:false};
 if(/stale.revision|revision veraltet|spielstand hat sich geändert|session has changed|gleichzeitig geändert/.test(e))
  return {type:'stale',title:'Spielstand wurde anderswo geändert',
   next:'Den aktuellen Stand explizit neu laden; danach Revision, Punkte, Aufgabe und Beamer prüfen. Keine automatische Wiederholung der Aktion.',reload:true};
 if(/wiederherstell|wiederhergestell|recovery|gesicherten stand/.test(e))
  return {type:'recovery',title:'Wiederherstellung erfordert Prüfung',
   next:'Wiederherstellung ausschließlich im vorhandenen Prüfmodus bestätigen; Beamer bleibt bis dahin gesperrt.',reload:true};
 if(/network|netz|offline|verbindung/.test(e))
  return {type:'offline',title:'Verbindung prüfen',
   next:'Lokalen Spielstand und Offline-Vorbereitung kontrollieren. Keine mehrfachen Wertungsversuche senden.',reload:true};
 return {type:'unknown',title:'Aktion nicht bestätigt',
  next:'Keine Aktion erneut auslösen, bevor der aktuelle Punktestand und die Spielrevision geprüft wurden.',reload:true};
}
