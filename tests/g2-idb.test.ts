import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { EventRepository } from '../src/infrastructure/db/event-repository';
import { createEvent } from '../src/domain/event/transition';
import { derivePublicStage } from '../src/domain/event/public-projection';
import type { EventRecord, SessionCommand } from '../src/domain/event/schemas';

let seq = 0;
const connections: EventRepository[] = [];
function makeRepo(name?: string) {
  const repo = new EventRepository(fakeIndexedDB, name ?? 'g2-test-' + ++seq);
  connections.push(repo);
  return repo;
}
afterEach(async () => {
  await Promise.all(connections.map((repo) => repo.close()));
  connections.length = 0;
});
function seed(): EventRecord {
  return createEvent({
    id: 'e1', hostId: 'host-1', at: 1,
    teams: Array.from({ length: 3 }, (_, n) => ({
      id: 'team-' + n, order: n, name: 'Team ' + n, colorToken: 'c' + n,
    })),
    program: [{ id: 'g1', type: 'rundenquiz', profile: 'standard', order: 0, rulesVersion: 'rq/1' }],
    frozenTasks: [{ taskId: 'q1', gameType: 'rundenquiz', publicPrompt: 'Wer folgte Mose?',
      publicClues: ['Hinweis A', 'Hinweis B'], privateAnswers: ['Josua'], moderatorNotes: 'HOST-SECRET',
      sourceContentId: 'content-1', sourceHash: 'sha123' }],
  });
}
function cmd(s: EventRecord, payload: SessionCommand, id: string) {
  return {
    protocolVersion: 1, commandId: id, eventId: s.id,
    hostId: s.hostId, hostEpoch: s.hostEpoch, expectedRevision: s.revision,
    issuedAtEpochMs: 20 + s.revision, actor: 'host', payload,
  };
}
async function send(repo: EventRepository, s: EventRecord, payload: SessionCommand, id: string) {
  const receipt = await repo.dispatch(cmd(s, payload, id));
  const latest = await repo.get(s.id);
  if (!latest) throw new Error('missing latest');
  return { receipt, latest };
}
async function startAndReveal(repo: EventRepository) {
  await repo.create(seed());
  let s = seed();
  s = (await send(repo, s, { type: 'EVENT_START' }, 'start')).latest;
  s = (await send(repo, s, { type: 'TASK_PUBLISH', taskId: 'q1' }, 'publish')).latest;
  s = (await send(repo, s, { type: 'SOLUTION_PUBLISH', taskId: 'q1' }, 'solution')).latest;
  return s;
}

describe('G2 real IndexedDB semantics in fake browser storage', () => {
  it('commits a score exactly once across retries and multiple host controllers', async () => {
    const name = 'idem-' + ++seq, a = makeRepo(name), b = makeRepo(name);
    const ready = await startAndReveal(a);
    const command = cmd(ready, { type: 'OUTCOME_COMMIT', outcomeId: 'award-one', taskId: 'q1', teamId: 'team-1', points: 8 }, 'cmd-score');
    const results = await Promise.all([a.dispatch(command), b.dispatch(command)]);
    expect(results.map((r) => r.effect).sort()).toEqual(['already-committed', 'committed']);
    expect(await a.getScores('e1')).toEqual({ 'team-0': 0, 'team-1': 8, 'team-2': 0 });
    expect((await a.get('e1'))?.revision).toBe(4);
    expect((await b.dispatch({ ...command, expectedRevision: 0, issuedAtEpochMs: 999 })).effect).toBe('already-committed');
    await expect(b.dispatch({ ...command, payload: { ...command.payload, points: 99 } }))
      .rejects.toMatchObject({ code: 'COMMAND_ID_COLLISION' });
    expect(await b.dispatch({ ...command, commandId: 'new-id', expectedRevision: 4 }))
      .rejects.toMatchObject({ code: 'DUPLICATE_OUTCOME' });
    expect((await a.getCheckpoints('e1')).map((c) => c.revision)).toEqual([0, 1, 2, 3, 4]);
    expect((await a.getAudit('e1')).map((x) => x.kind)).toContain('OUTCOME_COMMIT');
  });
  it('rejects stale revisions and old host epoch after explicit takeover', async () => {
    const repo = makeRepo();
    await repo.create(seed());
    const old = seed();
    const event1 = (await send(repo, old, { type: 'EVENT_START' }, 'start')).latest;
    await expect(repo.dispatch(cmd(old, { type: 'EVENT_START' }, 'another'))).rejects.toMatchObject({ code: 'STALE_REVISION' });
    const takeover = await repo.takeover({
      eventId: 'e1', commandId: 'takeover-1', newHostId: 'host-2',
      expectedRevision: event1.revision, expectedEpoch: event1.hostEpoch,
      at: 30, reason: 'Host laptop disconnected', acknowledged: true,
    });
    expect(takeover.revision).toBe(2);
    const taken = await repo.get('e1');
    expect(taken?.hostId).toBe('host-2');
    expect(taken?.hostEpoch).toBe(2);
    expect(taken?.lifecycle).toBe('paused');
    if (!taken) throw new Error('missing');
    await expect(repo.dispatch({ ...cmd(taken, { type: 'EVENT_RESUME' }, 'host-invalid'), hostId: 'host-1' }))
      .rejects.toMatchObject({ code: 'STALE_HOST' });
    const resumed = await send(repo, taken, { type: 'EVENT_RESUME' }, 'resume');
    expect(resumed.latest.lifecycle).toBe('active');
    expect((await repo.takeover({
      eventId: 'e1', commandId: 'takeover-1', newHostId: 'host-2',
      expectedRevision: event1.revision, expectedEpoch: event1.hostEpoch,
      at: 30, reason: 'Host laptop disconnected', acknowledged: true,
    })).effect).toBe('already-committed');
  });
  it('supports audited score void/restore without changing immutable original outcome', async () => {
    const repo = makeRepo();
    let s = await startAndReveal(repo);
    s = (await send(repo, s, { type: 'OUTCOME_COMMIT', outcomeId: 'o1', taskId: 'q1', teamId: 'team-0', points: 4 }, 'score')).latest;
    expect((await repo.getScores('e1'))['team-0']).toBe(4);
    s = (await send(repo, s, { type: 'OUTCOME_VOID', outcomeId: 'o1', reason: 'Incorrect award' }, 'undo')).latest;
    expect((await repo.getScores('e1'))['team-0']).toBe(0);
    expect((await repo.getOutcomes('e1'))[0]).toMatchObject({ points: 4, status: 'void', createdRevision: 4 });
    s = (await send(repo, s, { type: 'OUTCOME_RESTORE', outcomeId: 'o1', reason: 'Host correction' }, 'redo')).latest;
    expect((await repo.getScores('e1'))['team-0']).toBe(4);
    expect((await repo.getAudit('e1')).map((a) => a.kind).slice(-3)).toEqual(['OUTCOME_COMMIT', 'OUTCOME_VOID', 'OUTCOME_RESTORE']);
  });
  it('does not change persisted state on domain rejection', async () => {
    const repo = makeRepo();
    let s = await startAndReveal(repo);
    await expect(repo.dispatch(cmd(s, { type: 'OUTCOME_COMMIT', outcomeId: 'o1', taskId: 'q1', teamId: 'invalid', points: 1 }, 'bad')))
      .rejects.toMatchObject({ code: 'UNKNOWN_TEAM' });
    expect((await repo.get('e1'))?.revision).toBe(s.revision);
    expect(await repo.getOutcomes('e1')).toEqual([]);
    expect((await repo.getAudit('e1'))).toHaveLength(4);
    s = (await send(repo, s, { type: 'OUTCOME_COMMIT', outcomeId: 'o1', taskId: 'q1', teamId: 'team-2', points: 3 }, 'ok')).latest;
    expect(s.revision).toBe(4);
  });
  it('rolls back every store if an IndexedDB write fails late in the transaction', async () => {
    const name = 'rollback-' + ++seq, repo = makeRepo(name);
    let s = await startAndReveal(repo);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = fakeIndexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('audit', 'readwrite');
    tx.objectStore('audit').add({
      eventId: 'e1', revision: 4, kind: 'INJECTED', actorId: 'fault', commandId: 'fault',
      at: 1, detail: 'forces constraint error after other writes queued',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    await expect(repo.dispatch(cmd(s, { type: 'OUTCOME_COMMIT', outcomeId: 'o1', taskId: 'q1', teamId: 'team-1', points: 6 }, 'failing')))
      .rejects.toThrow();
    expect((await repo.get('e1'))?.revision).toBe(3);
    expect(await repo.getOutcomes('e1')).toEqual([]);
    expect((await repo.getCheckpoints('e1'))).toHaveLength(4);
    s = (await repo.get('e1'))!;
    expect(s.revision).toBe(3);
  });
  it('recovers an invalid snapshot only from same revision checkpoint into paused review mode', async () => {
    const name = 'recover-' + ++seq, repo = makeRepo(name);
    const active = await startAndReveal(repo);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = fakeIndexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('events', 'readwrite');
    tx.objectStore('events').put({ ...active, teams: [] });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    await expect(repo.get('e1')).rejects.toMatchObject({ code: 'CORRUPT_SESSION' });
    const result = await repo.recoverLatest({
      eventId: 'e1', commandId: 'recover1', newHostId: 'repair-host',
      expectedRevision: 3, expectedEpoch: 1, at: 70, acknowledged: true,
    });
    expect(result.revision).toBe(4);
    let recovered = await repo.get('e1');
    expect(recovered).toMatchObject({ lifecycle: 'paused', recoveryRequired: true, hostEpoch: 2, hostId: 'repair-host' });
    expect(derivePublicStage(recovered!).scene.kind).toBe('waiting');
    await expect(repo.dispatch(cmd(recovered!, { type: 'EVENT_RESUME' }, 'premature')))
      .rejects.toMatchObject({ code: 'RECOVERY_LOCKED' });
    recovered = (await send(repo, recovered!, { type: 'RECOVERY_CONFIRM' }, 'checked')).latest;
    expect(recovered.recoveryRequired).toBe(false);
    expect(recovered.lifecycle).toBe('paused');
  });
});
