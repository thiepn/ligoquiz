import {
  eventSchema, envelopeSchema, outcomeSchema, receiptSchema, checkpointSchema, auditSchema,
  type EventRecord, type OutcomeRecord, type CommandReceipt,
  type CheckpointRecord, type AuditRecord,
} from '../../domain/event/schemas';
import { applySessionCommand } from '../../domain/event/transition';
import { timerSnapshotSchema, timerScopeMatches, type TimerSnapshot } from '../../games/rundenquiz/timer';

export const G2_DATABASE_NAME = 'ligoquiz.v2.sessions';
const VERSION = 2;
const STORES = ['events', 'commands', 'outcomes', 'checkpoints', 'audit'] as const;
const newError = (message: string) => new Error(message);

export type StoreErrorCode =
  | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'STALE_REVISION' | 'STALE_HOST'
  | 'COMMAND_ID_COLLISION' | 'CORRUPT_SESSION' | 'RECOVERY_UNAVAILABLE'
  | 'TAKEOVER_CONFIRM_REQUIRED' | 'IDB_UNAVAILABLE';
export class StoreError extends Error {
  constructor(readonly code: StoreErrorCode, message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
export type DispatchResult = {
  readonly effect: 'committed' | 'already-committed';
  readonly revision: number;
  readonly stageRevision: number;
  readonly commandId: string;
};
export type TakeoverRequest = {
  eventId: string; commandId: string; newHostId: string;
  expectedRevision: number; expectedEpoch: number;
  at: number; reason: string; acknowledged: true;
};
export type RecoveryRequest = {
  eventId: string; commandId: string; newHostId: string;
  expectedRevision: number; expectedEpoch: number;
  at: number; acknowledged: true;
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? newError('IndexedDB request failed'));
  });
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? newError('IndexedDB transaction rolled back'));
    tx.onerror = () => reject(tx.error ?? newError('IndexedDB transaction error'));
  });
}
function abortTransaction(tx: IDBTransaction, error: unknown): void {
  try { tx.abort(); } catch { /* transaction may already be aborting */ }
  // Throwing happens at the caller; transaction abortion is mandatory.
  void error;
}
function receiptOf(eventId: string, commandId: string, fingerprint: string, session: EventRecord): CommandReceipt {
  return {
    eventId, commandId, fingerprint,
    revision: session.revision, stageRevision: session.stageRevision,
  };
}
function checkpointOf(session: EventRecord): CheckpointRecord {
  return { eventId: session.id, revision: session.revision, snapshot: session };
}

export class EventRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  constructor(
    private readonly factory: IDBFactory = indexedDB,
    private readonly name: string = G2_DATABASE_NAME,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.factory) {
        reject(new StoreError('IDB_UNAVAILABLE', 'IndexedDB is required for saved sessions'));
        return;
      }
      const req = this.factory.open(this.name, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('timers')) db.createObjectStore('timers', { keyPath: 'eventId' });
        if (!db.objectStoreNames.contains('commands')) db.createObjectStore('commands', { keyPath: ['eventId', 'commandId'] });
        if (!db.objectStoreNames.contains('outcomes')) {
          const store = db.createObjectStore('outcomes', { keyPath: ['eventId', 'outcomeId'] });
          store.createIndex('byEvent', 'eventId');
        }
        if (!db.objectStoreNames.contains('checkpoints')) {
          const store = db.createObjectStore('checkpoints', { keyPath: ['eventId', 'revision'] });
          store.createIndex('byEvent', 'eventId');
        }
        if (!db.objectStoreNames.contains('audit')) {
          const store = db.createObjectStore('audit', { keyPath: ['eventId', 'revision'] });
          store.createIndex('byEvent', 'eventId');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new StoreError('IDB_UNAVAILABLE', 'Failed to open IndexedDB'));
      req.onblocked = () => reject(new StoreError('IDB_UNAVAILABLE', 'Database upgrade blocked by another tab'));
    }).catch((error: unknown) => { this.dbPromise = null; throw error; });
    return this.dbPromise;
  }
  async close(): Promise<void> {
    const pending = this.dbPromise;
    this.dbPromise = null;
    if (pending) (await pending).close();
  }
  /**
   * Advisory timer snapshots live in the G2 database but are not score authority.
   * Save is fenced by host ownership, epoch, task and open phase in ONE transaction.
   */
  async getTimer(eventId:string):Promise<TimerSnapshot|null>{
    const db=await this.open();
    const tx=db.transaction('timers','readonly');
    const value:unknown=await requestResult(tx.objectStore('timers').get(eventId));
    const result=timerSnapshotSchema.safeParse(value);
    return result.success?result.data:null;
  }
  async saveTimer(snapshot:TimerSnapshot):Promise<void>{
    const candidate=timerSnapshotSchema.parse(snapshot);
    const db=await this.open();
    return new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['events','timers'],'readwrite');
      let error:unknown;
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(error??tx.error??newError('Timer transaction failed'));
      const request=tx.objectStore('events').get(candidate.eventId);
      request.onsuccess=()=>{
        try{
          const record=eventSchema.parse(request.result);
          if(!record.rundenquiz||!timerScopeMatches(record.rundenquiz,candidate))
            throw new StoreError('STALE_HOST','Timer does not belong to the active host and task');
          tx.objectStore('timers').put(candidate);
        }catch(caught){error=caught;abortTransaction(tx,caught);}
      };
    });
  }

  async create(seed: EventRecord): Promise<EventRecord> {
    const event = eventSchema.parse(seed);
    if (event.revision !== 0 || event.hostEpoch !== 1 || event.stageRevision !== 0 || event.lifecycle !== 'draft') {
      throw new StoreError('ALREADY_EXISTS', 'New event must start at revision zero');
    }
    const db = await this.open();
    const tx = db.transaction(['events', 'checkpoints', 'audit'], 'readwrite');
    const done = transactionDone(tx);
    try {
      tx.objectStore('events').add(event);
      tx.objectStore('checkpoints').add(checkpointOf(event));
      tx.objectStore('audit').add(auditSchema.parse({
        eventId: event.id, revision: 0, kind: 'CREATED', actorId: event.hostId,
        commandId: 'GENESIS', at: event.createdAt, detail: 'Event initialized',
      }));
      await done;
      return event;
    } catch (error) {
      await done.catch(() => undefined);
      throw error;
    }
  }

  /** Local organizer index. Damaged events are counted, not silently reset or overwritten. */
  async listSessions(): Promise<{ items: EventRecord[]; invalidCount: number }> {
    const db = await this.open();
    const tx = db.transaction('events', 'readonly');
    const raw: unknown[] = await requestResult(tx.objectStore('events').getAll());
    const items: EventRecord[] = [];
    let invalidCount = 0;
    for (const value of raw) {
      const validated = eventSchema.safeParse(value);
      if (validated.success) items.push(validated.data);
      else invalidCount++;
    }
    items.sort((a,b) => b.updatedAt - a.updatedAt || b.revision - a.revision || a.id.localeCompare(b.id));
    return { items, invalidCount };
  }

  async get(eventId: string): Promise<EventRecord | null> {
    const db = await this.open();
    const tx = db.transaction('events', 'readonly');
    const raw: unknown = await requestResult(tx.objectStore('events').get(eventId));
    if (!raw) return null;
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) throw new StoreError('CORRUPT_SESSION', 'Session is invalid; inspect checkpoints before continuing');
    return parsed.data;
  }
  async getOutcomes(eventId: string): Promise<OutcomeRecord[]> {
    const db = await this.open();
    const tx = db.transaction('outcomes', 'readonly');
    const records: unknown[] = await requestResult(tx.objectStore('outcomes').index('byEvent').getAll(eventId));
    return records.map((record) => outcomeSchema.parse(record));
  }
  /**
   * Derive scores and corresponding revision from ONE readonly transaction.
   * Two separate reads could otherwise mix different committed revisions.
   */
  async getScoreSnapshot(eventId: string): Promise<{ revision: number; scores: Record<string, number> }> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['events', 'outcomes'], 'readonly');
      const eventRequest = tx.objectStore('events').get(eventId);
      const outcomeRequest = tx.objectStore('outcomes').index('byEvent').getAll(eventId);
      tx.oncomplete = () => {
        try {
          const raw: unknown = eventRequest.result;
          if (!raw) throw new StoreError('NOT_FOUND', 'No such session');
          const parsed = eventSchema.safeParse(raw);
          if (!parsed.success) throw new StoreError('CORRUPT_SESSION', 'Stored session is invalid');
          const event = parsed.data;
          const scores = new Map<string, number>(event.teams.map((team) => [team.id, 0]));
          for (const rawOutcome of outcomeRequest.result as unknown[]) {
            const outcome = outcomeSchema.parse(rawOutcome);
            if (outcome.status !== 'active') continue;
            const existing = scores.get(outcome.teamId);
            if (existing === undefined) throw new StoreError('CORRUPT_SESSION', 'Outcome references unknown team');
            const total = existing + outcome.points;
            if (!Number.isSafeInteger(total)) throw new StoreError('CORRUPT_SESSION', 'Score exceeds safe integer range');
            scores.set(outcome.teamId, total);
          }
          resolve({ revision: event.revision, scores: Object.fromEntries(scores) });
        } catch (error) { reject(error); }
      };
      tx.onabort = () => reject(tx.error ?? newError('Score read aborted'));
      tx.onerror = () => { /* onabort handles transaction errors */ };
    });
  }
  async getScores(eventId: string): Promise<Record<string, number>> {
    return (await this.getScoreSnapshot(eventId)).scores;
  }
  async getAudit(eventId: string): Promise<AuditRecord[]> {
    const db = await this.open();
    const tx = db.transaction('audit', 'readonly');
    const raw: unknown[] = await requestResult(tx.objectStore('audit').index('byEvent').getAll(eventId));
    return raw.map((item) => auditSchema.parse(item));
  }
  async getCheckpoints(eventId: string): Promise<CheckpointRecord[]> {
    const db = await this.open();
    const tx = db.transaction('checkpoints', 'readonly');
    const raw: unknown[] = await requestResult(tx.objectStore('checkpoints').index('byEvent').getAll(eventId));
    return raw.map((item) => checkpointSchema.parse(item));
  }

  /**
   * All reads, validation, state transition, and writes occur in one IDB
   * readwrite transaction. Receipt replay is checked BEFORE revision fencing.
   * Results resolve only when oncomplete fires, never when a put is queued.
   */
  async dispatch(untrusted: unknown): Promise<DispatchResult> {
    const command = envelopeSchema.parse(untrusted);
    const fingerprint = JSON.stringify({
      eventId: command.eventId, commandId: command.commandId,
      hostId: command.hostId, hostEpoch: command.hostEpoch, payload: command.payload,
    });
    const db = await this.open();
    return new Promise<DispatchResult>((resolve, reject) => {
      const tx = db.transaction(STORES, 'readwrite');
      let response: DispatchResult | null = null;
      let ownError: unknown = null;
      const rejectAndAbort = (error: unknown) => {
        ownError = error;
        abortTransaction(tx, error);
      };
      tx.oncomplete = () => response ? resolve(response) : reject(newError('Missing committed response'));
      tx.onabort = () => reject(ownError ?? tx.error ?? newError('Transaction aborted'));
      tx.onerror = () => { /* onabort owns the error path */ };
      const commands = tx.objectStore('commands');
      const events = tx.objectStore('events');
      const outcomes = tx.objectStore('outcomes');
      const existingReceipt = commands.get([command.eventId, command.commandId]);
      existingReceipt.onsuccess = () => {
        const storedReceipt = existingReceipt.result as unknown;
        const readEvent = events.get(command.eventId);
        readEvent.onsuccess = () => {
          try {
            const record = readEvent.result as unknown;
            if (!record) throw new StoreError('NOT_FOUND', 'Event does not exist');
            const parsed = eventSchema.safeParse(record);
            if (!parsed.success) throw new StoreError('CORRUPT_SESSION', 'Stored event failed validation');
            const session = parsed.data;
            if (storedReceipt) {
              const receipt = receiptSchema.parse(storedReceipt);
              if (receipt.fingerprint !== fingerprint) {
                throw new StoreError('COMMAND_ID_COLLISION', 'Command ID was reused with different contents');
              }
              response = {
                effect: 'already-committed', revision: receipt.revision,
                stageRevision: receipt.stageRevision, commandId: command.commandId,
              };
              return;
            }
            if (command.expectedRevision !== session.revision) {
              throw new StoreError('STALE_REVISION', 'Session has changed; refresh before retrying');
            }
            if (command.hostEpoch !== session.hostEpoch || command.hostId !== session.hostId) {
              throw new StoreError('STALE_HOST', 'Another host owns this session');
            }
            const outcomeId = 'outcomeId' in command.payload ? command.payload.outcomeId : null;
            if(command.payload.type === 'RQ_ACTION' || command.payload.type === 'QT_ACTION' || command.payload.type === 'VB_ACTION') {
              const rqPrior = outcomes.index('byEvent').getAll(command.eventId);
              rqPrior.onsuccess = () => {
                try {
                  const list=(rqPrior.result as unknown[]).map(raw=>outcomeSchema.parse(raw));
                  commit(session,undefined,list);
                } catch(error){rejectAndAbort(error);}
              };
            } else if (outcomeId) {
              const readOutcome = outcomes.get([command.eventId, outcomeId]);
              readOutcome.onsuccess = () => {
                try {
                  const prior = readOutcome.result ? outcomeSchema.parse(readOutcome.result) : undefined;
                  commit(session, prior);
                } catch (error) { rejectAndAbort(error); }
              };
            } else {
              commit(session, undefined);
            }
          } catch (error) { rejectAndAbort(error); }
        };
      };
      const commit = (session: EventRecord, prior: OutcomeRecord | undefined, rqOutcomes: OutcomeRecord[] = []) => {
        const next = applySessionCommand(session, command, prior);
        if(command.payload.type==='RQ_ACTION' && session.rundenquiz && next.event.rundenquiz) {
          const previous=session.rundenquiz, changed=next.event.rundenquiz;
          const question=previous.questions[previous.index];
          if(!question)throw new StoreError('CORRUPT_SESSION','Rundenquiz task unavailable');
          const before=previous.awards.filter(a=>a.questionId===question.id);
          const after=changed.awards.filter(a=>a.questionId===question.id);
          if(JSON.stringify(before)!==JSON.stringify(after)) {
            for(const existing of rqOutcomes) {
              if(existing.taskId===question.id && existing.outcomeId.startsWith('rq-award-') && existing.status==='active')
                outcomes.put(outcomeSchema.parse({...existing,status:'void',updatedRevision:next.event.revision}));
            }
            for(const awarded of after) {
              outcomes.add(outcomeSchema.parse({
                eventId:session.id,
                outcomeId:'rq-award-'+next.event.revision+'-'+awarded.teamId,
                taskId:question.id,teamId:awarded.teamId,points:awarded.points,
                status:'active',createdRevision:next.event.revision,updatedRevision:next.event.revision,
              }));
            }
          }
        }
        if(command.payload.type==='QT_ACTION' && session.quiztafel && next.event.quiztafel){
          const before=session.quiztafel,after=next.event.quiztafel;
          const tileId=before.selectedTileId;
          if(tileId){
            const prior=before.outcomes.find(o=>o.tileId===tileId);
            const current=after.outcomes.find(o=>o.tileId===tileId);
            if(JSON.stringify(prior??null)!==JSON.stringify(current??null)){
              for(const saved of rqOutcomes){
                if(saved.taskId===tileId && saved.outcomeId.startsWith('qt-award-') && saved.status==='active')
                  outcomes.put(outcomeSchema.parse({...saved,status:'void',updatedRevision:next.event.revision}));
              }
              if(current){
                outcomes.add(outcomeSchema.parse({
                  eventId:session.id,outcomeId:'qt-award-'+next.event.revision+'-'+tileId,
                  taskId:tileId,teamId:current.winnerId??current.selectorId,points:current.points,
                  status:'active',createdRevision:next.event.revision,updatedRevision:next.event.revision,
                }));
              }
            }
          }
        }
        if(command.payload.type==='VB_ACTION'&&session.verbindungen&&next.event.verbindungen){
          const before=session.verbindungen,after=next.event.verbindungen;
          const puzzleId=before.assignments[before.index]?.puzzleId;
          if(puzzleId){
            const previous=before.awards.filter(a=>a.puzzleId===puzzleId);
            const current=after.awards.filter(a=>a.puzzleId===puzzleId);
            if(JSON.stringify(previous)!==JSON.stringify(current)){
              for(const saved of rqOutcomes){
                if(saved.taskId===puzzleId&&saved.outcomeId.startsWith('vb-award-')&&saved.status==='active')
                  outcomes.put(outcomeSchema.parse({...saved,status:'void',updatedRevision:next.event.revision}));
              }
              for(const a of current){
                outcomes.add(outcomeSchema.parse({
                  eventId:session.id,
                  outcomeId:'vb-award-'+next.event.revision+'-'+a.teamId,
                  taskId:puzzleId,teamId:a.teamId,points:a.points,
                  status:'active',createdRevision:next.event.revision,updatedRevision:next.event.revision,
                }));
              }
            }
          }
        }
        if (next.outcome) outcomes.put(outcomeSchema.parse(next.outcome));
        events.put(eventSchema.parse(next.event));
        tx.objectStore('checkpoints').add(checkpointOf(next.event));
        const receipt = receiptOf(session.id, command.commandId, fingerprint, next.event);
        commands.add(receiptSchema.parse(receipt));
        tx.objectStore('audit').add(auditSchema.parse({
          eventId: session.id, revision: next.event.revision, kind: command.payload.type,
          actorId: command.hostId, commandId: command.commandId,
          at: command.issuedAtEpochMs, detail: next.note,
        }));
        response = {
          effect: 'committed', revision: next.event.revision,
          stageRevision: next.event.stageRevision, commandId: command.commandId,
        };
      };
    });
  }

  /**
   * Explicit takeover only: epoch increments and previous host commands fail
   * even if their revision looked current. Never automatically claim on tab open.
   */
  async takeover(input: TakeoverRequest): Promise<DispatchResult> {
    if (!input.acknowledged || input.reason.trim().length < 3) {
      throw new StoreError('TAKEOVER_CONFIRM_REQUIRED', 'Host takeover needs an explicit confirmation and reason');
    }
    return this.specialMutation(input, 'HOST_TAKEOVER');
  }

  /**
   * Restore the checkpoint at the SAME stored revision, never silently
   * rewind outcomes/ledger. Following restore, the event is paused and requires
   * explicit recovery review before another game command.
   */
  async recoverLatest(input: RecoveryRequest): Promise<DispatchResult> {
    if (!input.acknowledged) throw new StoreError('TAKEOVER_CONFIRM_REQUIRED', 'Recovery requires explicit confirmation');
    return this.specialMutation(input, 'RECOVERY_RESTORE');
  }

  private async specialMutation(
    input: TakeoverRequest | RecoveryRequest, action: 'HOST_TAKEOVER' | 'RECOVERY_RESTORE',
  ): Promise<DispatchResult> {
    const db = await this.open();
    const fingerprint = JSON.stringify({ ...input, action });
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['events', 'commands', 'checkpoints', 'audit'], 'readwrite');
      let response: DispatchResult | null = null;
      let ownError: unknown;
      const abort = (error: unknown) => { ownError = error; abortTransaction(tx, error); };
      tx.oncomplete = () => response ? resolve(response) : reject(newError('No result'));
      tx.onabort = () => reject(ownError ?? tx.error ?? newError('Transaction aborted'));
      const commands = tx.objectStore('commands'), events = tx.objectStore('events');
      const req = commands.get([input.eventId, input.commandId]);
      req.onsuccess = () => {
        const entry = req.result as unknown;
        const snapshot = events.get(input.eventId);
        snapshot.onsuccess = () => {
          try {
            if (!snapshot.result) throw new StoreError('NOT_FOUND', 'Event does not exist');
            if (entry) {
              const old = receiptSchema.parse(entry);
              if (old.fingerprint !== fingerprint) throw new StoreError('COMMAND_ID_COLLISION', 'Different takeover under same command ID');
              response = { effect: 'already-committed', revision: old.revision, stageRevision: old.stageRevision, commandId: input.commandId };
              return;
            }
            const raw = snapshot.result as Record<string, unknown>;
            const old = eventSchema.safeParse(raw);
            if (action === 'HOST_TAKEOVER' && !old.success) throw new StoreError('CORRUPT_SESSION', 'Use explicit recovery for invalid snapshots');
            if (raw.revision !== input.expectedRevision) throw new StoreError('STALE_REVISION', 'Event revision changed');
            if (raw.hostEpoch !== input.expectedEpoch) throw new StoreError('STALE_HOST', 'Host epoch changed');
            const revision = input.expectedRevision + 1;
            const epoch = input.expectedEpoch + 1;
            const prior = old.success ? old.data : undefined;
            const finish = (candidate: EventRecord) => {
              const updated = eventSchema.parse({
                ...candidate, revision, hostEpoch: epoch, hostId: input.newHostId,
                ...(candidate.rundenquiz ? {rundenquiz:{
                  ...candidate.rundenquiz,ownerId:input.newHostId,epoch,
                  paused:action==='RECOVERY_RESTORE' || candidate.lifecycle==='active' ||
                    candidate.lifecycle==='paused' || candidate.rundenquiz.paused,
                }} : {}),
                ...(candidate.quiztafel?{quiztafel:{
                  ...candidate.quiztafel,ownerId:input.newHostId,epoch,
                  paused:action==='RECOVERY_RESTORE' || candidate.lifecycle==='active' ||
                    candidate.lifecycle==='paused'||candidate.quiztafel.paused,
                }}:{}),
                ...(candidate.verbindungen?{verbindungen:{
                  ...candidate.verbindungen,ownerId:input.newHostId,epoch,
                  paused:action==='RECOVERY_RESTORE'||candidate.lifecycle==='active'||
                    candidate.lifecycle==='paused'||candidate.verbindungen.paused,
                }}:{}),
                stageRevision: candidate.stageRevision + 1,
                lifecycle: candidate.lifecycle === 'active' ? 'paused' : candidate.lifecycle,
                recoveryRequired: action === 'RECOVERY_RESTORE' ? true : candidate.recoveryRequired,
                updatedAt: input.at,
              });
              events.put(updated);
              const receipt = receiptOf(input.eventId, input.commandId, fingerprint, updated);
              commands.add(receiptSchema.parse(receipt));
              tx.objectStore('checkpoints').add(checkpointOf(updated));
              tx.objectStore('audit').add(auditSchema.parse({
                eventId: input.eventId, revision, kind: action,
                actorId: input.newHostId, commandId: input.commandId,
                at: input.at, detail: action === 'HOST_TAKEOVER'
                  ? (input as TakeoverRequest).reason : 'Recovered from same-revision checkpoint; review required',
              }));
              response = { effect: 'committed', revision, stageRevision: updated.stageRevision, commandId: input.commandId };
            };
            if (action === 'HOST_TAKEOVER') {
              if (!prior) throw new StoreError('CORRUPT_SESSION', 'Missing validated session');
              finish(prior);
              return;
            }
            const checkpoints = tx.objectStore('checkpoints');
            const checkpoint = checkpoints.get([input.eventId, input.expectedRevision]);
            checkpoint.onsuccess = () => {
              try {
                if (!checkpoint.result) throw new StoreError('RECOVERY_UNAVAILABLE', 'No same-revision checkpoint found');
                const saved = checkpointSchema.parse(checkpoint.result).snapshot;
                // After a crash, do not automatically resume private/public state.
                finish({ ...saved, lifecycle: 'paused', recoveryRequired: true });
              } catch (error) { abort(error); }
            };
          } catch (error) { abort(error); }
        };
      };
    });
  }
}
