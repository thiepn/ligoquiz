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
  private readonly viewers = new Map<string, number>();
  readonly viewerTtlMs = 5400;
  get connectedViewers(): number {
    return [...this.viewers.values()].filter((seenAt) => Date.now() - seenAt < this.viewerTtlMs).length;
  }

  constructor(
    private readonly eventId: string,
    private readonly hostId: string,
    private readonly repo: Pick<EventRepository, 'get'>,
    private readonly port: StagePort,
    private readonly onStatus: (status: PublisherStatus) => void = () => undefined,
    private readonly onAudienceChange: (connected: number) => void = () => undefined,
  ) {}
  start(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe = this.port.subscribe((raw) => {
      const message = stageMessageSchema.safeParse(raw);
      if (!message.success || message.data.eventId !== this.eventId) return;
      if (message.data.kind === 'HELLO') {
        void this.refresh();
      } else if (message.data.kind === 'ACK' && this.latest &&
          message.data.hostEpoch === this.latest.hostEpoch &&
          message.data.stageRevision === this.latest.stageRevision) {
        this.viewers.set(message.data.viewerId, Date.now());
        this.onAudienceChange(this.connectedViewers);
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
      this.onAudienceChange(this.connectedViewers);
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
    this.viewers.clear();
    this.onAudienceChange(0);
    this.port.close();
  }
}
