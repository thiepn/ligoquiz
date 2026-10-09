import {z} from 'zod';
import {eventSchema,outcomeSchema,auditSchema,checkpointSchema,type EventRecord} from '../domain/event/schemas';
import {sha256} from '../content/migration';
export const MAX_BACKUP_BYTES=20*1024*1024;
export const backupPayloadSchema=z.strictObject({
 format:z.literal('ligoquiz-v2-session-backup'),version:z.literal(1),
 exportedAt:z.string(),
 event:eventSchema,
 outcomes:z.array(outcomeSchema).max(5000),
 audit:z.array(auditSchema).max(5000),
 checkpoints:z.array(checkpointSchema).max(5000),
});
export type BackupPayload=z.infer<typeof backupPayloadSchema>;
export type BackupFile={payload:BackupPayload;sha256:string};
export function validateBackupPayload(value:unknown):BackupPayload{
 const bundle=backupPayloadSchema.parse(value),id=bundle.event.id;
 if(bundle.outcomes.some(o=>o.eventId!==id)||bundle.audit.some(a=>a.eventId!==id)||
  bundle.checkpoints.some(c=>c.eventId!==id))
  throw Error('Sicherungsdaten enthalten andere Sitzungskennungen');
 if(bundle.audit.some(a=>a.revision>bundle.event.revision)||
  bundle.checkpoints.some(c=>c.revision>bundle.event.revision))
  throw Error('Backup enthält Daten aus einer zukünftigen Revision');
 if(new Set(bundle.audit.map(a=>a.revision)).size!==bundle.audit.length||
  new Set(bundle.checkpoints.map(c=>c.revision)).size!==bundle.checkpoints.length||
  new Set(bundle.outcomes.map(o=>o.outcomeId)).size!==bundle.outcomes.length)
  throw Error('Doppelte Ledger-/Audit- oder Checkpoint-Einträge');
 if(!bundle.checkpoints.some(c=>c.revision===bundle.event.revision))
  throw Error('Aktueller autoritativer Checkpoint fehlt');
 const snapshot=bundle.checkpoints.find(c=>c.revision===bundle.event.revision)!;
 if(JSON.stringify(snapshot.snapshot)!==JSON.stringify(bundle.event))
  throw Error('Letzter Checkpoint weicht vom exportierten Spielstand ab');
 return bundle;
}
export async function encodeBackup(payload:BackupPayload):Promise<string>{
 const safe=validateBackupPayload(payload),json=JSON.stringify(safe);
 if(new TextEncoder().encode(json).byteLength>MAX_BACKUP_BYTES)
  throw Error('Backup überschreitet 20 MiB');
 return JSON.stringify({payload:safe,sha256:await sha256(json)} satisfies BackupFile,null,2);
}
export async function decodeBackup(text:string):Promise<BackupPayload>{
 if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)
  throw Error('Backup überschreitet 20 MiB');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('Backup ist kein JSON');}
 if(!raw||typeof raw!=='object'||!('payload' in raw)||!('sha256' in raw))
  throw Error('Backup-Metadaten fehlen');
 const bundle=raw as Record<string,unknown>;
 if(typeof bundle.sha256!=='string')throw Error('Ungültiger Fingerabdruck');
 const actual=await sha256(JSON.stringify(bundle.payload));
 if(actual!==bundle.sha256)throw Error('Backup-Prüfsumme ungültig; Quelle nicht verändert');
 return validateBackupPayload(bundle.payload);
}
export function stagedRecovery(source:EventRecord,at:number,newHostId:string):EventRecord{
 // Imported sessions never reveal live questions before an explicit host review.
 const paused=source.lifecycle==='complete'?'complete':'paused';
 const enginePause=<T extends {paused:boolean}>(value:T|undefined)=>value?{...value,paused:paused!=='complete'}:undefined;
 return eventSchema.parse({
  ...source,lifecycle:paused,recoveryRequired:paused!=='complete',stageRevision:source.stageRevision+1,
  revision:source.revision+1,hostEpoch:source.hostEpoch+1,hostId:newHostId,updatedAt:at,
  ...(source.rundenquiz?{rundenquiz:{...enginePause(source.rundenquiz),ownerId:newHostId,epoch:source.hostEpoch+1}}:{}),
  ...(source.quiztafel?{quiztafel:{...enginePause(source.quiztafel),ownerId:newHostId,epoch:source.hostEpoch+1}}:{}),
  ...(source.verbindungen?{verbindungen:{...enginePause(source.verbindungen),ownerId:newHostId,epoch:source.hostEpoch+1}}:{}),
  ...(source.logikleiter?{logikleiter:{...enginePause(source.logikleiter),ownerId:newHostId,epoch:source.hostEpoch+1}}:{}),
  ...(source.umfrageduell?{umfrageduell:{...enginePause(source.umfrageduell),ownerId:newHostId,epoch:source.hostEpoch+1}}:{}),
 });
}
