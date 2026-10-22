import {describe,expect,it} from 'vitest';
import type {EventRecord,AuditRecord} from '../src/domain/event/schemas';
import {backupHref,backupTargetFromHash,describeBackstageDirectory,safeBackstageAudit} from '../src/features/experience/backstage-model';
function event(id:string,lifecycle:EventRecord['lifecycle'],updatedAt:number,recoveryRequired=false):EventRecord{
 return {id,lifecycle,updatedAt,recoveryRequired} as EventRecord;
}
const entry=(revision:number,kind:string,detail:string):AuditRecord=>({
 eventId:'valid-event-1234',revision,kind,detail,actorId:'private-host-123',
 commandId:'private-command-'+revision,at:Date.UTC(2026,9,19)+revision,
});
describe('U10 original-only backstage snapshots and safe navigation',()=>{
 it('sorts immutable directory metadata and never counts abandoned as open',()=>{
  const values=[
   event('session-aaa','complete',30),event('session-bbb','active',11,true),
   event('session-ccc','abandoned',60),event('session-ddd','draft',55),
   event('session-eee','complete',45),event('session-fff','complete',35),
   event('session-ggg','complete',25),
  ];
  const original=values.map(v=>v.id);
  const s=describeBackstageDirectory(values,2);
  expect({open:s.open,finished:s.finished,review:s.review,invalid:s.invalid}).toEqual({
   open:2,finished:4,review:1,invalid:2,
  });
  expect(s.latestOpen?.id).toBe('session-ddd');
  expect(s.latestFinished.map(v=>v.id)).toEqual(['session-eee','session-fff','session-aaa']);
  expect(values.map(v=>v.id)).toEqual(original);
 });
 it('keeps per-session backup selection as a strict link, not an export',()=>{
  const id='a1b2c3d4-5566-7788-99aa-bbccddeeff00';
  const route=backupHref(id);
  expect(route).toBe('#/einstellungen?backup='+id);
  expect(backupTargetFromHash(route)).toBe(id);
  expect(backupTargetFromHash('#/einstellungen')).toBeNull();
  expect(backupTargetFromHash('#/verlauf?backup='+id)).toBeNull();
  expect(backupTargetFromHash('#/einstellungen?backup=%2e%2e%2fsecret')).toBeNull();
  expect(backupTargetFromHash('#/einstellungen?backup=%3Cscript%3E')).toBeNull();
  expect(backupTargetFromHash('#/einstellungen?backup=tiny')).toBeNull();
 });
 it('never includes private actor ids, command ids, raw notes, or answers in the displayed audit',()=>{
  const rows=[
   entry(2,'UD_ACTION','Private solution: Josua, password=do-not-show'),
   entry(1,'HOST_TAKEOVER','Sensitive operator note'),
   entry(3,'OUTCOME_VOID','Unpublished full answer with owner token'),
  ];
  const safe=safeBackstageAudit(rows);
  expect(safe.map(v=>v.revision)).toEqual([3,2,1]);
  expect(safe.map(v=>v.category)).toEqual(['scoring','moderation','security']);
  expect(safe.map(v=>v.label)).toEqual(['Wertung zurückgenommen','Umfrageduell-Spielaktion','Spielleitung übernommen']);
  const text=JSON.stringify(safe);
  for(const secret of ['Josua','password','private-host','private-command','Sensitive operator','owner token'])
   expect(text).not.toContain(secret);
  expect(rows[0]?.detail).toContain('Josua');
 });
 it('labels publication separately and fails closed for unfamiliar audit kinds',()=>{
  const safe=safeBackstageAudit([
   entry(1,'TASK_PUBLISH','private internal'),
   entry(2,'ANY_UNRECOGNIZED_KIND','hidden'),
  ]);
  expect(safe.map(v=>v.category)).toEqual(['moderation','publication']);
  expect(safe[0]?.label).toBe('Gespeicherte Spielaktion');
  expect(safe[1]?.label).toBe('Frage veröffentlicht');
 });
});
