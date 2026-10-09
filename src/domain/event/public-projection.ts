import { z } from 'zod';
import type { EventRecord } from './schemas';
import { publicScene as rqPublicScene } from '../../games/rundenquiz/engine';
import { publicScene as qtPublicScene } from '../../games/quiztafel/engine';
import { publicScene as vbPublicScene } from '../../games/verbindungen/engine';
import { publicScene as llPublicScene } from '../../games/logikleiter/engine';
import {publicScene as udPublicScene} from '../../games/umfrageduell/engine';
import { projectTaskForAudience, waitingScene, type PublicStageDto } from '../projection/public-stage';

const publicSceneSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('waiting'), heading: z.string() }),
  z.strictObject({ kind: z.literal('paused'), heading: z.literal('Pause') }),
  z.strictObject({kind:z.literal('ud-prompt'),heading:z.string(),format:z.enum(['popular','top3']),
    step:z.number().int().positive(),total:z.number().int().positive(),prompt:z.string(),
    provenance:z.string(),sourceContext:z.string().nullable()}),
  z.strictObject({kind:z.literal('ud-reveal'),heading:z.string(),format:z.enum(['popular','top3']),
    step:z.number().int().positive(),total:z.number().int().positive(),prompt:z.string(),
    categories:z.array(z.string()).length(5),provenance:z.string(),sourceContext:z.string().nullable()}),
  z.strictObject({kind:z.literal('ll-ladder'),heading:z.string(),step:z.number().int().positive(),total:z.number().int().positive(),points:z.number().int().positive(),prompt:z.string(),hint:z.string().nullable()}),
  z.strictObject({kind:z.literal('ll-answer'),heading:z.string(),step:z.number().int().positive(),total:z.number().int().positive(),points:z.number().int().positive(),prompt:z.string(),answer:z.string(),explanation:z.string()}),
  z.strictObject({kind:z.literal('vb-sequence'),heading:z.string(),activeTeam:z.string(),
    prompt:z.string(),items:z.array(z.string()).length(3)}),
  z.strictObject({kind:z.literal('vb-wall'),heading:z.string(),
    tiles:z.array(z.strictObject({id:z.string(),label:z.string()})).length(16),
    revealed:z.array(z.strictObject({id:z.string(),tileIds:z.array(z.string()).length(4),link:z.string()})).max(4)}),
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
  if(session.umfrageduell){
    const ud=udPublicScene(session.umfrageduell),game=session.program[0];
    const provenance=(source:{kind:'illustrative'}|{kind:'observed';source:string;population:string;method:string;collectedOn:string;limitations:string})=>
      source.kind==='illustrative'?'BEISPIELDATEN – KEINE ECHTE UMFRAGE':'ECHTE UMFRAGE – QUELLE SIEHE HINWEIS';
    const context=(source:{kind:'illustrative'}|{kind:'observed';source:string;population:string;method:string;collectedOn:string;limitations:string})=>
      source.kind==='illustrative'?null:
      source.source+' · '+source.population+' · '+source.method+' · '+source.collectedOn+' · '+source.limitations;
    const scene=session.recoveryRequired?waitingScene():
      session.lifecycle==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      ud.kind==='waiting'?waitingScene():
      ud.kind==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      ud.kind==='prompt'?{kind:'ud-prompt' as const,heading:'Umfrageduell',
        format:ud.format,step:ud.step,total:ud.total,prompt:ud.prompt,
        provenance:provenance(ud.source),sourceContext:context(ud.source)}:
      ud.kind==='reveal'?{kind:'ud-reveal' as const,heading:'Umfrageduell · Auflösung',
        format:ud.format,step:ud.step,total:ud.total,prompt:ud.prompt,
        categories:ud.categories,provenance:provenance(ud.source),sourceContext:context(ud.source)}:
      ud.kind==='scores'?{kind:'scores' as const,heading:ud.final?'Umfrageduell · Endstand':'Umfrageduell · Zwischenstand',
        visibleScores:ud.teams.map(t=>({name:t.name,value:t.points})).sort((a,b)=>b.value-a.value)}:
      waitingScene();
    return publicDtoSchema.parse({protocolVersion:1,eventId:session.id,gameId:game?.id??null,
      hostEpoch:session.hostEpoch,stageRevision:session.stageRevision,scene});
  }
  if(session.logikleiter){
    const ll=llPublicScene(session.logikleiter),game=session.program[0];
    const scene=session.recoveryRequired?waitingScene():
      session.lifecycle==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      ll.kind==='waiting'?waitingScene():
      ll.kind==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      ll.kind==='ladder'?{kind:'ll-ladder' as const,heading:'Logikleiter',
        step:ll.step,total:ll.total,points:ll.points,prompt:ll.prompt,hint:ll.hint}:
      ll.kind==='answer'?{kind:'ll-answer' as const,heading:'Logikleiter · Auflösung',
        step:ll.step,total:ll.total,points:ll.points,prompt:ll.prompt,answer:ll.answer,
        explanation:ll.explanation}:
      ll.kind==='scores'?{kind:'scores' as const,heading:ll.final?'Endstand':'Zwischenstand',
        visibleScores:ll.teams.map(t=>({name:t.name,value:t.points})).sort((a,b)=>b.value-a.value)}:
      waitingScene();
    return publicDtoSchema.parse({protocolVersion:1,eventId:session.id,gameId:game?.id??null,
      hostEpoch:session.hostEpoch,stageRevision:session.stageRevision,scene});
  }
  if(session.verbindungen){
    const vb=vbPublicScene(session.verbindungen),game=session.program[0];
    const scene=session.recoveryRequired?waitingScene():
      session.lifecycle==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      vb.kind==='waiting'?waitingScene():
      vb.kind==='paused'?{kind:'paused' as const,heading:'Pause' as const}:
      vb.kind==='clues'?{kind:'question' as const,
        heading:'Vier Hinweise · '+vb.activeTeam,publicPrompt:'Welche Person oder Verbindung ist gesucht?',
        visibleClues:vb.clues}:
      vb.kind==='sequence'?{kind:'vb-sequence' as const,
        heading:'Folge ergänzen',activeTeam:vb.activeTeam,prompt:vb.prompt,items:vb.items}:
      vb.kind==='wall'?{kind:'vb-wall' as const,
        heading:'Verbindungswand',tiles:vb.tiles,revealed:vb.revealed}:
      vb.kind==='answer'?{kind:'answer' as const,
        heading:'Verbindungen · Auflösung',publicPrompt:vb.prompt,publishedSolution:vb.answer}:
      vb.kind==='scores'?{kind:'scores' as const,heading:vb.final?'Endstand':'Zwischenstand',
        visibleScores:vb.teams.map(t=>({name:t.name,value:t.points}))
          .sort((a,b)=>b.value-a.value)}:waitingScene();
    return publicDtoSchema.parse({
      protocolVersion:1,eventId:session.id,gameId:game?.id??null,
      hostEpoch:session.hostEpoch,stageRevision:session.stageRevision,scene,
    });
  }
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
