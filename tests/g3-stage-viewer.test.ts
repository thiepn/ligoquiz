import { describe, expect, it } from 'vitest';
import { StageViewer } from '../src/features/stage/stage-viewer';
import { stageEventIdFromHash, stageUrl, stageMessageSchema, type StagePort, type StageMessage } from '../src/features/stage/protocol';

const EVENT = 'g3-event-test';
const testFrame = (revision: number, epoch = 1, scene = {
  kind: 'question' as const, heading: 'Wissen',
  publicPrompt: 'Wer war es?', visibleClues: ['Hinweis'],
}) => ({
  protocolVersion: 1 as const, eventId: EVENT, gameId: 'game-1',
  hostEpoch: epoch, stageRevision: revision, scene,
});
class SpyPort implements StagePort {
  readonly sent: StageMessage[] = [];
  private handler: ((data: unknown) => void) | null = null;
  closeCount = 0;
  send(message: StageMessage): void { this.sent.push(message); }
  subscribe(handler: (data: unknown) => void): () => void {
    this.handler = handler;
    return () => { this.handler = null; };
  }
  deliver(value: unknown): void { this.handler?.(value); }
  close(): void { this.closeCount++; }
}
const packet = (frame: ReturnType<typeof testFrame>) => ({
  protocolVersion: 1, kind: 'FRAME', eventId: EVENT, frame,
});

describe('G3 stage viewer: protocol, safety and reconnection', () => {
  it('accepts a valid event route, rejects malformed parameters and schemas', () => {
    expect(stageEventIdFromHash('#/stage?event=' + EVENT)).toBe(EVENT);
    expect(stageUrl(EVENT)).toBe('#/stage?event=' + EVENT);
    expect(stageEventIdFromHash('#/stage?event=')).toBeNull();
    expect(stageEventIdFromHash('#/stage?event=../abc')).toBeNull();
    expect(stageEventIdFromHash('#/spielen?event=' + EVENT)).toBeNull();
    expect(stageMessageSchema.safeParse(packet(testFrame(1))).success).toBe(true);
    expect(stageMessageSchema.safeParse({ ...packet(testFrame(1)), privateAnswers: ['SECRET'] }).success).toBe(false);
    expect(stageMessageSchema.safeParse({ ...packet(testFrame(1)), frame: { ...testFrame(1), privateAnswers: ['SECRET'] } }).success).toBe(false);
  });
  it('handshakes, acknowledges and keeps public frame fresh', () => {
    let now = 100;
    const port = new SpyPort();
    const viewer = new StageViewer(EVENT, port, () => undefined, { now: () => now, makeId: () => 'test-id' });
    viewer.start();
    expect(port.sent[0]?.kind).toBe('HELLO');
    expect(viewer.state.status).toBe('connecting');
    port.deliver(packet(testFrame(1)));
    expect(viewer.state.status).toBe('live');
    expect(viewer.state.frame?.scene.kind).toBe('question');
    expect(port.sent[1]).toMatchObject({ kind: 'ACK', eventId: EVENT, stageRevision: 1, hostEpoch: 1 });
    now = 1000;
    port.deliver(packet(testFrame(1)));
    expect(viewer.state.lastReceivedAt).toBe(1000);
    now = 5000;
    viewer.tick();
    expect(viewer.state.status).toBe('live');
    viewer.stop();
    expect(port.closeCount).toBe(1);
  });
  it('fails closed after host loss, then recovers from an identical valid heartbeat', () => {
    let now = 100;
    const port = new SpyPort(), viewer = new StageViewer(EVENT, port, () => undefined, {
      now: () => now, makeId: () => 'viewer-id', expireAfterMs: 3000, requestEveryMs: 1000,
    });
    viewer.start();
    port.deliver(packet(testFrame(3)));
    now = 3201;
    viewer.tick();
    expect(viewer.state).toMatchObject({ status: 'stale', frame: null });
    expect(port.sent.at(-1)?.kind).toBe('HELLO');
    port.deliver(packet(testFrame(3)));
    expect(viewer.state.status).toBe('live');
    viewer.stop();
  });
  it('rejects outdated revisions and outdated epochs after a takeover', () => {
    const port = new SpyPort(), viewer = new StageViewer(EVENT, port, () => undefined);
    viewer.start();
    port.deliver(packet(testFrame(7, 1)));
    port.deliver(packet(testFrame(4, 1)));
    expect(viewer.state.frame?.stageRevision).toBe(7);
    port.deliver(packet(testFrame(8, 2)));
    port.deliver(packet(testFrame(99, 1)));
    expect(viewer.state.frame?.hostEpoch).toBe(2);
    expect(viewer.state.frame?.stageRevision).toBe(8);
    viewer.stop();
  });
  it('quarantines same-version conflicting frames until a strictly newer revision arrives', () => {
    const port = new SpyPort(), viewer = new StageViewer(EVENT, port, () => undefined);
    viewer.start();
    port.deliver(packet(testFrame(1)));
    port.deliver(packet(testFrame(1, 1, { kind: 'question', heading: 'Wissen', publicPrompt: 'Different', visibleClues: [] })));
    expect(viewer.state).toMatchObject({ status: 'conflict', frame: null });
    port.deliver(packet(testFrame(1)));
    expect(viewer.state.frame).toBeNull();
    port.deliver(packet(testFrame(2)));
    expect(viewer.state).toMatchObject({ status: 'live', frame: { stageRevision: 2 } });
    viewer.stop();
  });
  it('ignores invalid events, unexpected message kinds, private payloads and unknown protocols', () => {
    const port = new SpyPort(), viewer = new StageViewer(EVENT, port, () => undefined);
    viewer.start();
    port.deliver({ ...packet(testFrame(1)), eventId: 'another-event' });
    port.deliver({ ...packet(testFrame(1)), protocolVersion: 3 });
    port.deliver({ ...packet(testFrame(1)), frame: { ...testFrame(1), answerKey: 'secret' } });
    port.deliver({ protocolVersion: 1, kind: 'HELLO', eventId: EVENT, viewerId: 'x', requestId: 'x' });
    expect(viewer.state).toMatchObject({ status: 'connecting', frame: null });
    viewer.stop();
  });
});
