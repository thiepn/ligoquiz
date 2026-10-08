import { z } from 'zod';
import { GAME_TYPES } from '../game/contracts';

const id = z.string().min(1).max(128);
const nonnegative = z.number().int().min(0).safe();
const positive = z.number().int().positive().safe();

export const teamSchema = z.strictObject({
  id, order: nonnegative, name: z.string().trim().min(1).max(40),
  colorToken: z.string().min(1).max(32),
});
export const gameSchema = z.strictObject({
  id, type: z.enum(GAME_TYPES), profile: z.enum(['kurz', 'standard', 'lang']),
  order: nonnegative, rulesVersion: id,
});
export const taskSchema = z.strictObject({
  taskId: id, gameType: z.enum(GAME_TYPES),
  publicPrompt: z.string().min(1).max(3000),
  publicClues: z.array(z.string().max(2000)).max(12),
  privateAnswers: z.array(z.string().min(1).max(2000)).min(1).max(30),
  moderatorNotes: z.string().max(4000).optional(),
  sourceContentId: id, sourceHash: id,
});

export const eventSchema = z.strictObject({
  id, schemaVersion: z.literal(1), revision: nonnegative,
  hostEpoch: positive, hostId: id,
  lifecycle: z.enum(['draft', 'ready', 'active', 'paused', 'between', 'final-review', 'complete', 'abandoned']),
  teams: z.array(teamSchema).min(3).max(5),
  program: z.array(gameSchema).min(1).max(5),
  frozenTasks: z.array(taskSchema),
  currentTaskId: id.nullable(),
  publishedClueCount: nonnegative,
  solutionPublished: z.boolean(),
  stageRevision: nonnegative,
  recoveryRequired: z.boolean(),
  createdAt: nonnegative, updatedAt: nonnegative,
}).superRefine((value, ctx) => {
  function unique(items: readonly { id: string }[], path: string) {
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate ID', path: [path] });
    }
  }
  unique(value.teams, 'teams');
  unique(value.program, 'program');
  if (new Set(value.frozenTasks.map((task) => task.taskId)).size !== value.frozenTasks.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate frozen task ID', path: ['frozenTasks'] });
  }
  if (new Set(value.teams.map((team) => team.order)).size !== value.teams.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate team order', path: ['teams'] });
  }
  if (new Set(value.program.map((game) => game.order)).size !== value.program.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate game order', path: ['program'] });
  }
  const games = new Set(value.program.map((game) => game.type));
  for (const task of value.frozenTasks) {
    if (!games.has(task.gameType)) ctx.addIssue({
      code: 'custom', message: 'Task has no matching game type', path: ['frozenTasks'],
    });
  }
  const current = value.frozenTasks.find((task) => task.taskId === value.currentTaskId);
  if (value.currentTaskId && !current) ctx.addIssue({
    code: 'custom', message: 'Current task not frozen in event', path: ['currentTaskId'],
  });
  if (value.publishedClueCount > (current?.publicClues.length ?? 0)) ctx.addIssue({
    code: 'custom', message: 'Clue count exceeds published task', path: ['publishedClueCount'],
  });
  if (!current && (value.solutionPublished || value.publishedClueCount)) ctx.addIssue({
    code: 'custom', message: 'Cannot publish without current task', path: ['currentTaskId'],
  });
});
export type EventRecord = z.infer<typeof eventSchema>;

const commandPayloadSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('EVENT_START') }),
  z.strictObject({ type: z.literal('EVENT_PAUSE') }),
  z.strictObject({ type: z.literal('EVENT_RESUME') }),
  z.strictObject({ type: z.literal('TASK_PUBLISH'), taskId: id }),
  z.strictObject({ type: z.literal('HINT_PUBLISH'), taskId: id, clueIndex: nonnegative }),
  z.strictObject({ type: z.literal('SOLUTION_PUBLISH'), taskId: id }),
  z.strictObject({ type: z.literal('OUTCOME_COMMIT'), outcomeId: id, taskId: id, teamId: id, points: nonnegative }),
  z.strictObject({ type: z.literal('OUTCOME_VOID'), outcomeId: id, reason: z.string().trim().min(3).max(500) }),
  z.strictObject({ type: z.literal('OUTCOME_RESTORE'), outcomeId: id, reason: z.string().trim().min(3).max(500) }),
  z.strictObject({ type: z.literal('NEXT_TASK') }),
  z.strictObject({ type: z.literal('EVENT_COMPLETE') }),
  z.strictObject({ type: z.literal('RECOVERY_CONFIRM') }),
]);
export const envelopeSchema = z.strictObject({
  protocolVersion: z.literal(1), commandId: id, eventId: id,
  expectedRevision: nonnegative, hostEpoch: positive, hostId: id,
  issuedAtEpochMs: nonnegative, actor: z.literal('host'),
  payload: commandPayloadSchema,
});
export type CommandEnvelopeV2 = z.infer<typeof envelopeSchema>;
export type SessionCommand = CommandEnvelopeV2['payload'];

export const outcomeSchema = z.strictObject({
  eventId: id, outcomeId: id, taskId: id, teamId: id, points: nonnegative,
  status: z.enum(['active', 'void']), createdRevision: positive, updatedRevision: positive,
});
export type OutcomeRecord = z.infer<typeof outcomeSchema>;

export const receiptSchema = z.strictObject({
  eventId: id, commandId: id, fingerprint: z.string().min(1),
  revision: nonnegative, stageRevision: nonnegative,
});
export type CommandReceipt = z.infer<typeof receiptSchema>;

export const auditSchema = z.strictObject({
  eventId: id, revision: nonnegative, kind: id, actorId: id,
  commandId: id, at: nonnegative, detail: z.string().max(600),
});
export type AuditRecord = z.infer<typeof auditSchema>;

export const checkpointSchema = z.strictObject({
  eventId: id, revision: nonnegative, snapshot: eventSchema,
});
export type CheckpointRecord = z.infer<typeof checkpointSchema>;
