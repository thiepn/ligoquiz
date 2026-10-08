import { createEvent } from '../../domain/event/transition';
import { derivePublicStage } from '../../domain/event/public-projection';
import { envelopeSchema, type CommandEnvelopeV2, type EventRecord, type SessionCommand } from '../../domain/event/schemas';
import { EventRepository, StoreError } from '../../infrastructure/db/event-repository';

/**
 * Host is the only session writer. G3 attaches a public-only transport to
 * afterCommit; no browser message is sent until IndexedDB commits.
 */
export class HostSessionController {
  constructor(
    private readonly repo: EventRepository,
    readonly eventId: string,
    readonly hostId: string,
    private readonly afterCommit?: (event: EventRecord, publicFrame: ReturnType<typeof derivePublicStage>) => void,
  ) {}

  async create(seed: Omit<Parameters<typeof createEvent>[0], 'id' | 'hostId' | 'at'>): Promise<EventRecord> {
    const state = createEvent({ ...seed, id: this.eventId, hostId: this.hostId, at: Date.now() });
    return this.repo.create(state);
  }
  async submit(payload: SessionCommand, state: EventRecord, commandId: string): Promise<EventRecord> {
    if (state.id !== this.eventId || state.hostId !== this.hostId) {
      throw new StoreError('STALE_HOST', 'Session belongs to another host');
    }
    const command: CommandEnvelopeV2 = envelopeSchema.parse({
      protocolVersion: 1, commandId, eventId: this.eventId,
      expectedRevision: state.revision, hostEpoch: state.hostEpoch,
      hostId: this.hostId, issuedAtEpochMs: Date.now(), actor: 'host',
      payload,
    });
    const receipt = await this.repo.dispatch(command);
    const current = await this.repo.get(this.eventId);
    if (!current) throw new StoreError('NOT_FOUND', 'Committed event not found');
    // A newer revision may have committed since receipt; publish only the
    // latest validated projection, never the proposed pre-commit state.
    if (receipt.effect === 'committed' && this.afterCommit) {
      try {
        this.afterCommit(current, derivePublicStage(current));
      } catch (error) {
        // A presentation subscriber must not turn an already-saved commit into an apparent failure.
        console.error('Committed session, but stage notification failed', error);
      }
    }
    return current;
  }
  async load(): Promise<EventRecord> {
    const session = await this.repo.get(this.eventId);
    if (!session) throw new StoreError('NOT_FOUND', 'No such session');
    return session;
  }
  async scores(): Promise<Record<string, number>> {
    return this.repo.getScores(this.eventId);
  }
}
