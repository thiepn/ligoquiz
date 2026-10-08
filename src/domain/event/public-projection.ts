import { z } from 'zod';
import type { EventRecord } from './schemas';
import { projectTaskForAudience, waitingScene, type PublicStageDto } from '../projection/public-stage';

const publicSceneSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('waiting'), heading: z.string() }),
  z.strictObject({ kind: z.literal('paused'), heading: z.literal('Pause') }),
  z.strictObject({ kind: z.literal('question'), heading: z.string(), publicPrompt: z.string(), visibleClues: z.array(z.string()) }),
  z.strictObject({ kind: z.literal('answer'), heading: z.string(), publicPrompt: z.string(), publishedSolution: z.string() }),
  z.strictObject({ kind: z.literal('scores'), heading: z.string(), visibleScores: z.array(z.strictObject({ name: z.string(), value: z.number() })) }),
]);
export const publicDtoSchema = z.strictObject({
  protocolVersion: z.literal(1),
  eventId: z.string(), gameId: z.string().nullable(),
  stageRevision: z.number().int().min(0),
  hostEpoch: z.number().int().positive(),
  scene: publicSceneSchema,
});

export function derivePublicStage(session: EventRecord): PublicStageDto {
  const current = session.frozenTasks.find((task) => task.taskId === session.currentTaskId);
  const game = current && session.program.find((entry) => entry.type === current.gameType);
  const scene = session.recoveryRequired
    ? waitingScene()
    : session.lifecycle === 'paused'
      ? { kind: 'paused' as const, heading: 'Pause' as const }
      : session.lifecycle !== 'active' || !current
        ? waitingScene()
        : projectTaskForAudience({
          heading: game?.type ?? 'Quizfrage',
          prompt: current.publicPrompt,
          clues: current.publicClues,
          answerKey: current.privateAnswers,
          visibleClueCount: session.publishedClueCount,
          solutionPublished: session.solutionPublished,
        });
  return publicDtoSchema.parse({
    protocolVersion: 1, eventId: session.id, gameId: game?.id ?? null,
    stageRevision: session.stageRevision, hostEpoch: session.hostEpoch, scene,
  });
}
