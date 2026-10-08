import { derivePublicStage } from '../../domain/event/public-projection';
import type { EventRepository } from '../../infrastructure/db/event-repository';
import { stageMessageSchema, type StagePort } from './protocol';
import type { PublicStageDto } from '../../domain/projection/public-stage';

export type PublisherStatus = 'ready' | 'revoked' | 'missing' | 'invalid';

/**
 * Only the persisted authoritative host may publish, even on HELLO and
 * heartbeats. The queue prevents stale asynchronous reads from reordering.
 */
export class HostStagePublisher {
  private unsubscribe: (() => void) | null = null;
  private active = false;
  private chain: Promise<void> = Promise.resolve();
  private latest: PublicStageDto | null = null;

  constructor(
    private readonly eventId: string,
    private readonly hostId: string,
    private readonly repo: Pick<EventRepository, 'get'>,
    private readonly port: StagePort,
    private readonly onStatus: (status: PublisherStatus) => void = () => undefined,
  ) {}
  start(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe = this.port.subscribe((raw) => {
      const message = stageMessageSchema.safeParse(raw);
      if (message.success && message.data.kind === 'HELLO' && message.data.eventId === this.eventId) {
        void this.refresh();
      }
    });
    void this.refresh();
  }
  /** Can be called by commit hook AND by a bounded heartbeat timer. */
  refresh(): Promise<void> {
    this.chain = this.chain.then(async () => {
      if (!this.active) return;
      let session;
      try {
        session = await this.repo.get(this.eventId);
      } catch {
        // Invalid storage may contain private data; never forward it.
        this.onStatus('invalid');
        return;
      }
      if (!this.active) return;
      if (!session) {
        this.onStatus('missing');
        return;
      }
      if (session.hostId !== this.hostId) {
        this.onStatus('revoked');
        this.stop();
        return;
      }
      const frame = derivePublicStage(session);
      const previous = this.latest;
      if (previous && (frame.hostEpoch < previous.hostEpoch ||
          (frame.hostEpoch === previous.hostEpoch && frame.stageRevision < previous.stageRevision))) return;
      this.latest = frame;
      this.port.send(stageMessageSchema.parse({
        protocolVersion: 1, kind: 'FRAME', eventId: this.eventId, frame,
      }));
      this.onStatus('ready');
    }).catch(() => this.onStatus('invalid'));
    return this.chain;
  }
  stop(): void {
    this.active = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.port.close();
  }
}
