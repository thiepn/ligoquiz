import type { PublicStageDto } from '../../domain/projection/public-stage';
import { checkedFrame, stageMessageSchema, type StagePort, type StageMessage } from './protocol';

export type ViewerStatus = 'connecting' | 'live' | 'stale' | 'conflict';
export interface ViewerState {
  readonly status: ViewerStatus;
  readonly frame: PublicStageDto | null;
  readonly lastReceivedAt: number | null;
}
export interface ViewerSettings {
  readonly now?: () => number;
  readonly expireAfterMs?: number;
  readonly requestEveryMs?: number;
  readonly makeId?: () => string;
}

/**
 * Projector ONLY uses public messages, never IndexedDB, event aggregate,
 * scores ledger or sessionStorage. A lost host blanks the scene.
 *
 * Stale ordering is lexicographic (hostEpoch, stageRevision). Duplicate equal
 * frames are heartbeats; contradictory equal-version frames fail closed.
 */
export class StageViewer {
  private readonly now: () => number;
  private readonly expireAfterMs: number;
  private readonly requestEveryMs: number;
  private readonly makeId: () => string;
  private readonly viewerId: string;
  private unsubscribe: (() => void) | null = null;
  private lastRequestAt = -Infinity;
  private blockedVersion: string | null = null;
  private highwater: PublicStageDto | null = null;
  private view: ViewerState = { status: 'connecting', frame: null, lastReceivedAt: null };

  constructor(
    private readonly eventId: string,
    private readonly port: StagePort,
    private readonly onChange: (view: ViewerState) => void,
    settings: ViewerSettings = {},
  ) {
    this.now = settings.now ?? Date.now;
    this.expireAfterMs = settings.expireAfterMs ?? 5500;
    this.requestEveryMs = settings.requestEveryMs ?? 1800;
    this.makeId = settings.makeId ?? (() => crypto.randomUUID());
    this.viewerId = this.makeId();
  }
  get state(): ViewerState { return this.view; }
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.port.subscribe((data) => this.receive(data));
    this.emit({ status: 'connecting', frame: null, lastReceivedAt: null });
    this.request();
  }
  request(): void {
    this.lastRequestAt = this.now();
    const message: StageMessage = {
      protocolVersion: 1, kind: 'HELLO', eventId: this.eventId,
      viewerId: this.viewerId, requestId: this.makeId(),
    };
    this.port.send(message);
  }
  tick(): void {
    if (!this.unsubscribe) return;
    const now = this.now();
    if (this.view.status === 'live' && this.view.lastReceivedAt !== null
        && now - this.view.lastReceivedAt > this.expireAfterMs) {
      this.emit({ status: 'stale', frame: null, lastReceivedAt: null });
    }
    if (this.view.status !== 'live' && now - this.lastRequestAt >= this.requestEveryMs) this.request();
  }
  receive(data: unknown): void {
    if (!this.unsubscribe) return;
    const parsed = stageMessageSchema.safeParse(data);
    if (!parsed.success || parsed.data.kind !== 'FRAME') return;
    if (parsed.data.eventId !== this.eventId || parsed.data.frame.eventId !== this.eventId) return;
    const frame = checkedFrame(parsed.data.frame);
    if (!frame) return;
    const key = frame.hostEpoch + ':' + frame.stageRevision;
    if (key === this.blockedVersion) return;
    const prev = this.highwater;
    if (prev) {
      if (frame.hostEpoch < prev.hostEpoch ||
          (frame.hostEpoch === prev.hostEpoch && frame.stageRevision < prev.stageRevision)) return;
      if (frame.hostEpoch === prev.hostEpoch && frame.stageRevision === prev.stageRevision &&
          JSON.stringify(frame) !== JSON.stringify(prev)) {
        this.blockedVersion = key;
        this.emit({ status: 'conflict', frame: null, lastReceivedAt: null });
        this.request();
        return;
      }
    }
    this.highwater = frame;
    this.blockedVersion = null;
    const now = this.now();
    if (this.view.status === 'live' &&
        JSON.stringify(this.view.frame) === JSON.stringify(frame)) {
      this.view = { status: 'live', frame, lastReceivedAt: now };
      return;
    }
    this.emit({ status: 'live', frame, lastReceivedAt: now });
  }
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.port.close();
  }
  private emit(view: ViewerState): void {
    this.view = view;
    this.onChange(view);
  }
}
