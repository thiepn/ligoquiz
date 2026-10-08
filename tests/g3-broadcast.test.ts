import { describe, expect, it, vi } from 'vitest';
import { createEvent } from '../src/domain/event/transition';
import { HostStagePublisher } from '../src/features/stage/host-publisher';
import { StageViewer } from '../src/features/stage/stage-viewer';
import { BrowserStagePort } from '../src/features/stage/protocol';

describe('G3 native BroadcastChannel transport', () => {
  it('connects independent ports, handshakes and acknowledges a public snapshot', async () => {
    const eventId = 'browser-g3-' + crypto.randomUUID();
    const session = createEvent({
      id: eventId, hostId: 'host-owner', at: 1,
      teams: [0, 1, 2].map((n) => ({
        id: 'team-' + n, name: 'Team ' + n, order: n, colorToken: 'color-' + n,
      })),
      program: [{ id: 'game-1', type: 'rundenquiz', profile: 'kurz', order: 0, rulesVersion: 'g3-test' }],
      frozenTasks: [{
        taskId: 'demo-1', gameType: 'rundenquiz', publicPrompt: 'Beispielfrage',
        publicClues: ['Öffentlich'], privateAnswers: ['SECRET-ANSWER'],
        sourceContentId: 'demo', sourceHash: 'test-hash',
      }],
    });
    const repo = { get: async (id: string) => id === eventId ? session : null };
    const host = new HostStagePublisher(eventId, session.hostId, repo, new BrowserStagePort(eventId));
    const viewer = new StageViewer(eventId, new BrowserStagePort(eventId), () => undefined);
    try {
      host.start();
      viewer.start();
      await vi.waitFor(() => {
        expect(viewer.state.status).toBe('live');
        expect(host.connectedViewers).toBe(1);
      }, { timeout: 3000, interval: 20 });
      expect(viewer.state.frame?.scene.kind).toBe('waiting');
      expect(JSON.stringify(viewer.state.frame)).not.toContain('SECRET-ANSWER');
    } finally {
      viewer.stop();
      host.stop();
    }
  });
});
