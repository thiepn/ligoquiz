import { describe, expect, it } from 'vitest';
import { createEvent, applySessionCommand, DomainError } from '../src/domain/event/transition';
import { derivePublicStage } from '../src/domain/event/public-projection';
import { eventSchema, envelopeSchema, type EventRecord, type CommandEnvelopeV2, type SessionCommand } from '../src/domain/event/schemas';

export function eventFixture(): EventRecord {
  return createEvent({
    id: 'event-01', hostId: 'host-A', at: 1000,
    teams: [0, 1, 2].map((n) => ({
      id: 'team-' + n, order: n, name: 'Team ' + n, colorToken: 'color-' + n,
    })),
    program: [{ id: 'game-1', type: 'rundenquiz', profile: 'standard', order: 0, rulesVersion: 'rq/1' }],
    frozenTasks: [{ taskId: 'task-1', gameType: 'rundenquiz', publicPrompt: 'Wer folgte Mose?',
      publicClues: ['Leiter', 'Buch Josua'], privateAnswers: ['Josua'], moderatorNotes: 'PRIVATE-SECRET',
      sourceContentId: 'rq-01', sourceHash: 'hash-01' }],
  });
}
export function envelopeFor(event: EventRecord, type: SessionCommand, id: string): CommandEnvelopeV2 {
  return envelopeSchema.parse({
    protocolVersion: 1, commandId: id, eventId: event.id,
    hostEpoch: event.hostEpoch, hostId: event.hostId, expectedRevision: event.revision,
    actor: 'host', issuedAtEpochMs: 1010 + event.revision, payload: type,
  });
}

describe('G2 strict event transitions and publication', () => {
  it('validates initial roster, program and frozen content', () => {
    const e = eventFixture();
    expect(e.revision).toBe(0);
    expect(() => eventSchema.parse({ ...e, teams: e.teams.slice(0, 2) })).toThrow();
    expect(() => eventSchema.parse({ ...e, teams: [e.teams[0], e.teams[0], e.teams[2]] })).toThrow();
    expect(() => eventSchema.parse({ ...e, currentTaskId: 'missing' })).toThrow();
  });
  it('requires deliberate, sequential public reveals', () => {
    let e = eventFixture();
    const call = (command: SessionCommand, id: string) => {
      e = applySessionCommand(e, envelopeFor(e, command, id), undefined).event;
      return e;
    };
    expect(() => call({ type: 'TASK_PUBLISH', taskId: 'task-1' }, 'early')).toThrow(DomainError);
    call({ type: 'EVENT_START' }, 'start');
    call({ type: 'TASK_PUBLISH', taskId: 'task-1' }, 'publish');
    let shown = derivePublicStage(e);
    expect(JSON.stringify(shown)).not.toContain('Josua');
    expect(JSON.stringify(shown)).not.toContain('PRIVATE-SECRET');
    expect(() => call({ type: 'HINT_PUBLISH', taskId: 'task-1', clueIndex: 1 }, 'out-order')).toThrow();
    call({ type: 'HINT_PUBLISH', taskId: 'task-1', clueIndex: 0 }, 'hint-1');
    shown = derivePublicStage(e);
    expect(JSON.stringify(shown)).toContain('Leiter');
    expect(JSON.stringify(shown)).not.toContain('Buch Josua');
    expect(() => call({ type: 'NEXT_TASK' }, 'no-reveal')).toThrow();
    call({ type: 'SOLUTION_PUBLISH', taskId: 'task-1' }, 'reveal');
    expect(JSON.stringify(derivePublicStage(e))).toContain('Josua');
    call({ type: 'NEXT_TASK' }, 'next');
    expect(derivePublicStage(e).scene.kind).toBe('waiting');
    expect(e.stageRevision).toBe(5);
  });
  it('rejects unknown typed commands and mutations', () => {
    const e = eventFixture();
    expect(() => envelopeSchema.parse({
      ...envelopeFor(e, { type: 'EVENT_START' }, 'x'),
      payload: { type: 'EVENT_START', leaked: 'secret' },
    })).toThrow();
    expect(() => applySessionCommand(e, envelopeFor(e, { type: 'EVENT_PAUSE' }, 'bad'), undefined)).toThrow();
  });
});
