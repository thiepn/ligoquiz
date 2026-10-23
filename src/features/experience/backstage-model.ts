import type {EventRecord,AuditRecord} from '../../domain/event/schemas';

/** Canonical directory metadata only. No additional session writer or store. */
export type BackstageDirectory={
 open:number;finished:number;review:number;invalid:number;
 latestFinished:readonly EventRecord[];latestOpen:EventRecord|null;
};
export function describeBackstageDirectory(items:readonly EventRecord[],invalid:number):BackstageDirectory{
 const sorted=[...items].sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
 const open=sorted.filter(e=>e.lifecycle!=='complete'&&e.lifecycle!=='abandoned');
 return {
  open:open.length,finished:sorted.filter(e=>e.lifecycle==='complete').length,
  review:open.filter(e=>e.recoveryRequired).length,invalid,
  latestFinished:sorted.filter(e=>e.lifecycle==='complete').slice(0,3),
  latestOpen:open[0]??null,
 };
}
/** A deep link selects an existing IDB session but never initiates export. */
export function backupHref(eventId:string):string{
 return '#/einstellungen?backup='+encodeURIComponent(eventId);
}
export function backupTargetFromHash(hash:string):string|null{
 if(!hash.startsWith('#/einstellungen?'))return null;
 const selected=new URLSearchParams(hash.slice(hash.indexOf('?')+1)).get('backup');
 return selected&&/^[A-Za-z0-9_-]{8,128}$/.test(selected)?selected:null;
}
export type BackstageAuditCategory='security'|'scoring'|'publication'|'moderation';
export type BackstageAuditItem={revision:number;at:number;label:string;category:BackstageAuditCategory};
/** Audit detail, actor and command IDs can contain private notes: never display them.
 * Full original evidence remains inside the consent-based validated backup. */
export function safeBackstageAudit(rows:readonly AuditRecord[]):BackstageAuditItem[]{
 const labels:Record<string,string>={
  CREATED:'Abend vorbereitet',HOST_TAKEOVER:'Spielleitung übernommen',
  RECOVERY_CONFIRM:'Wiederherstellung bestätigt',G11_BACKUP_RESTORE:'Aus Sicherung wiederhergestellt',
  EVENT_START:'Abend gestartet',EVENT_PAUSE:'Spiel pausiert',EVENT_RESUME:'Spiel fortgesetzt',
  EVENT_COMPLETE:'Abend abgeschlossen',TASK_PUBLISH:'Frage veröffentlicht',
  HINT_PUBLISH:'Hinweis veröffentlicht',SOLUTION_PUBLISH:'Lösung bewusst veröffentlicht',
  OUTCOME_COMMIT:'Wertung bestätigt',OUTCOME_VOID:'Wertung zurückgenommen',
  OUTCOME_RESTORE:'Wertung wiederhergestellt',NEXT_TASK:'Nächste Aufgabe',
  RQ_ACTION:'Rundenquiz-Spielaktion',QT_ACTION:'Quiztafel-Spielaktion',
  VB_ACTION:'Verbindungen-Spielaktion',LL_ACTION:'Logikleiter-Spielaktion',
  UD_ACTION:'Umfrageduell-Spielaktion',
 };
 const security=new Set(['HOST_TAKEOVER','RECOVERY_CONFIRM','G11_BACKUP_RESTORE']);
 const scoring=new Set(['OUTCOME_COMMIT','OUTCOME_VOID','OUTCOME_RESTORE']);
 const publication=new Set(['TASK_PUBLISH','HINT_PUBLISH','SOLUTION_PUBLISH']);
 return [...rows].sort((a,b)=>b.revision-a.revision).map(entry=>({
  revision:entry.revision,at:entry.at,
  label:labels[entry.kind]??'Gespeicherte Spielaktion',
  category:security.has(entry.kind)?'security':scoring.has(entry.kind)?'scoring':
   publication.has(entry.kind)?'publication':'moderation',
 }));
}
