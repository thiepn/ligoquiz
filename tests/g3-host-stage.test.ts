import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvent } from '../src/domain/event/transition';
import { EventRepository } from '../src/infrastructure/db/event-repository';
import { HostStagePublisher } from '../src/features/stage/host-publisher';
import { StageViewer } from '../src/features/stage/stage-viewer';
import type { StageMessage, StagePort } from '../src/features/stage/protocol';
import { HostSessionController } from '../src/application/host-controller/host-session';

const EVENT = 'g3-event-test';
let counter = 0;
const openRepos: EventRepository[] = [];
afterEach(async () => {
  await Promise.all(openRepos.map((db) => db.close()));
  openRepos.length = 0;
});

class MemoryHub {
  private ports = new Set<MemoryPort>();
  newPort(): MemoryPort { const port = new MemoryPort(this); this.ports.add(port); return port; }
  deliver(sender: MemoryPort, message: StageMessage): void {
    for (const port of this.ports) if (port !== sender) port.deliver(message);
  }
  remove(port: MemoryPort): void { this.ports.delete(port); }
}
class MemoryPort implements StagePort {
  private listeners = new Set<(data: unknown) => void>();
  constructor(private hub: MemoryHub) {}
  send(data: StageMessage): void { this.hub.deliver(this, data); }
  subscribe(listener: (data: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  deliver(data: unknown): void { for (const listener of this.listeners) listener(data); }
  close(): void { this.listeners.clear(); this.hub.remove(this); }
}

async function fixture() {
  const repo = new EventRepository(fakeIndexedDB, 'stage-integration-' + ++counter);
  openRepos.push(repo);
  const session = createEvent({
    id: EVENT, hostId: 'host-authority', at: 100,
    teams: [1, 2, 3].map((i) => ({
      id: 'team-' + i, order: i - 1, name: 'Team ' + i, colorToken: 'color-' + i,
    })),
    program: [{ id: 'game-rq', type: 'rundenquiz', profile: 'kurz', order: 0, rulesVersion: 'g3-test' }],
    frozenTasks: [{
      taskId: 'question-one', gameType: 'rundenquiz', publicPrompt: 'Wer folgte Mose?',
      publicClues: ['Hinweis A'], privateAnswers: ['PRIVAT-JOSUA'],
      moderatorNotes: 'NOT-FOR-PROJECTOR', sourceContentId: 'g3-test', sourceHash: 'hash',
    }],
  });
  await repo.create(session);
  return { repo, session };
}
describe('G3 host/projector integration with independent channel ports', () => {
  it('serves late joiners, deliberate reveal and confirmed projector peer', async () => {
    const { repo, session } = await fixture();
    const hub = new MemoryHub();
    const status: number[] = [];
    const publisher = new HostStagePublisher(EVENT, session.hostId, repo, hub.newPort(), () => undefined,
      (n) => status.push(n));
    publisher.start();
    const viewer = new StageViewer(EVENT, hub.newPort(), () => undefined, { makeId: () => 'viewer-one' });
    viewer.start();
    await publisher.refresh();
    expect(viewer.state).toMatchObject({ status: 'live', frame: { scene: { kind: 'waiting' } } });
    expect(publisher.connectedViewers).toBe(1);
    const controller = new HostSessionController(repo, EVENT, session.hostId,
      () => { void publisher.refresh(); });
    let s = await controller.submit({ type: 'EVENT_START' }, session, 'command-start');
    s = await controller.submit({ type: 'TASK_PUBLISH', taskId: 'question-one' }, s, 'command-question');
    await publisher.refresh();
    const stageText = JSON.stringify(viewer.state.frame);
    expect(stageText).toContain('Wer folgte Mose?');
    expect(stageText).not.toContain('PRIVAT-JOSUA');
    expect(stageText).not.toContain('NOT-FOR-PROJECTOR');
    const newViewer = new StageViewer(EVENT, hub.newPort(), () => undefined, { makeId: () => 'viewer-two' });
    newViewer.start();
    await publisher.refresh();
    expect(newViewer.state.frame?.scene.kind).toBe('question');
    expect(publisher.connectedViewers).toBe(2);
    s = await controller.submit({ type: 'SOLUTION_PUBLISH', taskId: 'question-one' }, s, 'command-reveal');
    expect(s.solutionPublished).toBe(true);
    await publisher.refresh();
    expect(viewer.state.frame?.scene.kind).toBe('answer');
    expect(JSON.stringify(viewer.state.frame)).toContain('PRIVAT-JOSUA');
    expect(status).toContain(2);
    newViewer.stop();
    viewer.stop();
    publisher.stop();
  });
  it('does not publish an uncommitted event and stops after newer host takes over', async () => {
    const { repo, session } = await fixture();
    const hub = new MemoryHub();
    const statuses: string[] = [];
    const publisher = new HostStagePublisher(EVENT, session.hostId, repo, hub.newPort(), (s) => statuses.push(s));
    publisher.start();
    const viewer = new StageViewer(EVENT, hub.newPort(), () => undefined, { makeId: () => 'stage2' });
    viewer.start();
    await publisher.refresh();
    expect(viewer.state.frame?.hostEpoch).toBe(1);
    await expect(repo.dispatch({
      protocolVersion: 1, commandId: 'bad', eventId: EVENT, hostId: session.hostId,
      hostEpoch: 1, expectedRevision: 0, issuedAtEpochMs: 150, actor: 'host',
      payload: { type: 'SOLUTION_PUBLISH', taskId: 'question-one' },
    })).rejects.toThrow();
    await publisher.refresh();
    expect(JSON.stringify(viewer.state.frame)).not.toContain('PRIVAT-JOSUA');
    await repo.takeover({
      eventId: EVENT, newHostId: 'host-new', expectedRevision: 0, expectedEpoch: 1,
      commandId: 'handoff', at: 160, reason: 'Host disconnected', acknowledged: true,
    });
    await publisher.refresh();
    expect(statuses).toContain('revoked');
    expect(publisher.connectedViewers).toBe(0);
    viewer.stop();
  });
  it('expires unacknowledged audience count even if host heartbeats continue', async () => {
    const { repo, session } = await fixture();
    const hub = new MemoryHub();
    const publisher = new HostStagePublisher(EVENT, session.hostId, repo, hub.newPort());
    publisher.start();
    const viewer = new StageViewer(EVENT, hub.newPort(), () => undefined, { makeId: () => 'viewer-three' });
    viewer.start();
    await publisher.refresh();
    expect(publisher.connectedViewers).toBe(1);
    viewer.stop();
    const realNow = Date.now;
    // Audience TTL can be tested without actually waiting five seconds.
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + publisher.viewerTtlMs + 100);
    try {
      await publisher.refresh();
      expect(publisher.connectedViewers).toBe(0);
    } finally {
      vi.restoreAllMocks();
      publisher.stop();
    }
  });
});
