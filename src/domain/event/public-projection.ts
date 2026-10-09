import { z } from 'zod';
import type { EventRecord } from './schemas';
import { publicScene as rqPublicScene } from '../../games/rundenquiz/engine';
import { publicScene as qtPublicScene } from '../../games/quiztafel/engine';
import { projectTaskForAudience, waitingScene, type PublicStageDto } from '../projection/public-stage';

const publicSceneSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('waiting'), heading: z.string() }),
  z.strictObject({ kind: z.literal('paused'), heading: z.literal('Pause') }),
  z.strictObject({kind:z.literal('qt-board'),heading:z.string(),
    categories:z.array(z.strictObject({id:z.string(),name:z.string()})).min(3).max(5),
    rows:z.number().int().min(3).max(6),
    cells:z.array(z.strictObject({id:z.string(),categoryId:z.string(),row:z.number().int(),value:z.number().int(),closed:z.boolean()})),
    selectorName:z.string(),turn:z.number().int().nonnegative(),total:z.number().int().positive()}),
  z.strictObject({kind:z.literal('qt-question'),heading:z.string(),category:z.string(),
    points:z.number().int().min(100).max(600),publicPrompt:z.string(),
    selectorName:z.string(),respondingName:z.string(),steal:z.boolean()}),
  z.strictObject({kind:z.literal('qt-answer'),heading:z.string(),category:z.string(),
    points:z.number().int().min(100).max(600),publicPrompt:z.string(),publishedSolution:z.string()}),
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
  if(session.quiztafel){
    const qt=qtPublicScene(session.quiztafel),game=session.program[0];
    const scene=session.recoveryRequired?waitingScene():
      session.lifecycle==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      qt.kind==='waiting'?waitingScene():
      qt.kind==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      qt.kind==='board'?{
        kind:'qt-board' as const,heading:'Quiztafel',
        categories:qt.categories,rows:qt.rows,cells:qt.cells,
        selectorName:qt.selectorName,turn:qt.turn,total:qt.total,
      }:qt.kind==='question'?{
        kind:'qt-question' as const,heading:'Quiztafel · '+qt.category+' / '+qt.points,
        category:qt.category,points:qt.points,publicPrompt:qt.prompt,
        selectorName:qt.selectorName,respondingName:qt.respondingName,steal:qt.steal,
      }:qt.kind==='answer'?{
        kind:'qt-answer' as const,heading:'Quiztafel · '+qt.category+' / '+qt.points,
        category:qt.category,points:qt.points,publicPrompt:qt.prompt,
        publishedSolution:qt.answer,
      }:qt.kind==='results'?{
        kind:'scores' as const,heading:'Quiztafel · Endstand',
        visibleScores:qt.teams.map(t=>({name:t.name,value:t.points})),
      }:waitingScene();
    return publicDtoSchema.parse({
      protocolVersion:1,eventId:session.id,gameId:game?.id??null,
      stageRevision:session.stageRevision,hostEpoch:session.hostEpoch,scene,
    });
  }
  if(session.rundenquiz) {
    const rq=rqPublicScene(session.rundenquiz), game=session.program[0];
    const heading=(round:string)=>({wissen:'Wissen',hinweise:'Hinweise',schaetzen:'Schätzen',finale:'Finale'} as Record<string,string>)[round]??'Rundenquiz';
    const scene=session.recoveryRequired ? waitingScene()
      : session.lifecycle==='paused' ? {kind:'paused' as const,heading:'Pause' as const}
      : rq.kind==='waiting' ? waitingScene()
      : rq.kind==='paused' ? {kind:'paused' as const,heading:'Pause' as const}
      : rq.kind==='question' ? {
          kind:'question' as const,
          heading:heading(rq.round)+' · '+rq.current+'/'+rq.total,
          publicPrompt:rq.prompt,
          visibleClues:[...(rq.choices??[]),...rq.clues],
        }
      : rq.kind==='answer' ? {
          kind:'answer' as const,heading:heading(rq.round),
          publicPrompt:rq.prompt,publishedSolution:rq.solution,
        }
      : rq.kind==='results' ? {
          kind:'scores' as const,
          heading:rq.final?'Endstand':'Zwischenstand',
          visibleScores:rq.teams.map(t=>({name:t.name,value:rq.scores[t.id]??0}))
            .sort((a,b)=>b.value-a.value),
        } : waitingScene();
    return publicDtoSchema.parse({
      protocolVersion:1,eventId:session.id,gameId:game?.id??null,
      hostEpoch:session.hostEpoch,stageRevision:session.stageRevision,scene,
    });
  }
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
