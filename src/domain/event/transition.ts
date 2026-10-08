import { eventSchema, outcomeSchema, type CommandEnvelopeV2, type EventRecord, type OutcomeRecord } from './schemas';

export type Change = {
  event: EventRecord;
  outcome?: OutcomeRecord;
  stageChanged: boolean;
  note: string;
};

export class DomainError extends Error {
  constructor(
    readonly code: 'INVALID_PHASE' | 'UNKNOWN_TASK' | 'UNKNOWN_TEAM' | 'DUPLICATE_OUTCOME'
      | 'UNKNOWN_OUTCOME' | 'OUTCOME_ALREADY_VOID' | 'OUTCOME_ALREADY_ACTIVE'
      | 'RECOVERY_LOCKED' | 'INVALID_CLUE',
    message: string,
  ) { super(message); this.name = 'DomainError'; }
}
const fail = (code: DomainError['code'], message: string): never => { throw new DomainError(code, message); };

export function applySessionCommand(
  session: EventRecord, command: CommandEnvelopeV2,
  existingOutcome: OutcomeRecord | undefined,
): Change {
  const payload = command.payload;
  if (session.recoveryRequired && payload.type !== 'RECOVERY_CONFIRM') {
    fail('RECOVERY_LOCKED', 'Recovered session requires explicit host review');
  }
  let next: EventRecord = { ...session };
  let outcome: OutcomeRecord | undefined;
  let stageChanged = false;
  let note: string = payload.type;
  const active = () => {
    if (session.lifecycle !== 'active') fail('INVALID_PHASE', 'Game is not active');
  };
  switch (payload.type) {
    case 'EVENT_START':
      if (!['draft', 'ready'].includes(session.lifecycle)) fail('INVALID_PHASE', 'Event already started');
      next = { ...next, lifecycle: 'active' };
      stageChanged = true;
      break;
    case 'EVENT_PAUSE':
      active();
      next = { ...next, lifecycle: 'paused' };
      stageChanged = true;
      break;
    case 'EVENT_RESUME':
      if (session.lifecycle !== 'paused') fail('INVALID_PHASE', 'Event not paused');
      next = { ...next, lifecycle: 'active' };
      stageChanged = true;
      break;
    case 'TASK_PUBLISH': {
      active();
      const task = session.frozenTasks.find((item) => item.taskId === payload.taskId);
      if (!task) fail('UNKNOWN_TASK', 'Question is not part of frozen session');
      if (session.currentTaskId !== null) fail('INVALID_PHASE', 'Previous question must be advanced');
      next = {
        ...next, currentTaskId: task.taskId, publishedClueCount: 0,
        solutionPublished: false,
      };
      stageChanged = true;
      break;
    }
    case 'HINT_PUBLISH': {
      active();
      const task = session.frozenTasks.find((item) => item.taskId === payload.taskId);
      if (!task || task.taskId !== session.currentTaskId) fail('UNKNOWN_TASK', 'Not the active question');
      if (session.solutionPublished) fail('INVALID_PHASE', 'Answer already published');
      if (payload.clueIndex !== session.publishedClueCount ||
        payload.clueIndex >= task.publicClues.length) {
        fail('INVALID_CLUE', 'Hints must be revealed in order');
      }
      next = { ...next, publishedClueCount: session.publishedClueCount + 1 };
      stageChanged = true;
      break;
    }
    case 'SOLUTION_PUBLISH': {
      active();
      if (!session.currentTaskId || session.solutionPublished) fail('INVALID_PHASE', 'No hidden answer to reveal');
      next = { ...next, solutionPublished: true };
      stageChanged = true;
      break;
    }
    case 'NEXT_TASK':
      active();
      if (!session.currentTaskId || !session.solutionPublished) {
        fail('INVALID_PHASE', 'The current task needs an explicit reveal');
      }
      next = { ...next, currentTaskId: null, solutionPublished: false, publishedClueCount: 0 };
      stageChanged = true;
      break;
    case 'OUTCOME_COMMIT':
      active();
      if (!session.currentTaskId || !session.solutionPublished ||
        session.currentTaskId !== payload.taskId) {
        fail('INVALID_PHASE', 'Scores require the revealed active task');
      }
      if (!session.teams.some((team) => team.id === payload.teamId)) {
        fail('UNKNOWN_TEAM', 'Team is not registered');
      }
      if (existingOutcome) fail('DUPLICATE_OUTCOME', 'This logical outcome was already committed');
      outcome = outcomeSchema.parse({
        eventId: session.id, outcomeId: payload.outcomeId,
        taskId: payload.taskId, teamId: payload.teamId,
        points: payload.points, status: 'active',
        createdRevision: session.revision + 1, updatedRevision: session.revision + 1,
      });
      note = 'Score committed';
      break;
    case 'OUTCOME_VOID':
      if (!existingOutcome) fail('UNKNOWN_OUTCOME', 'No such score outcome');
      if (existingOutcome.status !== 'active') fail('OUTCOME_ALREADY_VOID', 'Already voided');
      outcome = { ...existingOutcome, status: 'void', updatedRevision: session.revision + 1 };
      note = 'Score voided: ' + payload.reason;
      break;
    case 'OUTCOME_RESTORE':
      if (!existingOutcome) fail('UNKNOWN_OUTCOME', 'No such score outcome');
      if (existingOutcome.status !== 'void') fail('OUTCOME_ALREADY_ACTIVE', 'Already active');
      outcome = { ...existingOutcome, status: 'active', updatedRevision: session.revision + 1 };
      note = 'Score restored: ' + payload.reason;
      break;
    case 'EVENT_COMPLETE':
      active();
      if (session.currentTaskId !== null) fail('INVALID_PHASE', 'Finish the current task first');
      next = { ...next, lifecycle: 'complete' };
      stageChanged = true;
      break;
    case 'RECOVERY_CONFIRM':
      if (!session.recoveryRequired || session.lifecycle !== 'paused') {
        fail('INVALID_PHASE', 'No pending recovery review');
      }
      next = { ...next, recoveryRequired: false };
      break;
    default: {
      const neverCommand: never = payload;
      throw new Error('Unimplemented command: ' + JSON.stringify(neverCommand));
    }
  }
  next = eventSchema.parse({
    ...next, revision: session.revision + 1,
    stageRevision: session.stageRevision + (stageChanged ? 1 : 0),
    updatedAt: command.issuedAtEpochMs,
  });
  return { event: next, outcome, stageChanged, note };
}

export function createEvent(seed: {
  id: string; hostId: string;
  teams: EventRecord['teams'];
  program: EventRecord['program'];
  frozenTasks: EventRecord['frozenTasks'];
  at: number;
}): EventRecord {
  return eventSchema.parse({
    id: seed.id, schemaVersion: 1, revision: 0,
    hostEpoch: 1, hostId: seed.hostId, lifecycle: 'draft',
    teams: seed.teams, program: seed.program, frozenTasks: seed.frozenTasks,
    currentTaskId: null, publishedClueCount: 0, solutionPublished: false,
    stageRevision: 0, recoveryRequired: false,
    createdAt: seed.at, updatedAt: seed.at,
  });
}
