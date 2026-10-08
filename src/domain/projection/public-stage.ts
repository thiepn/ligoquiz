/**
 * Projection uses explicit allowlisted fields. Never spread the private event,
 * full FrozenTask or internal command into a BroadcastChannel payload.
 */
export type PublicStageScene =
  | { readonly kind: 'waiting'; readonly heading: string }
  | { readonly kind: 'paused'; readonly heading: 'Pause' }
  | {
      readonly kind: 'qt-board';
      readonly heading: string;
      readonly categories: readonly { id: string; name: string }[];
      readonly rows: number;
      readonly cells: readonly {id:string;categoryId:string;row:number;value:number;closed:boolean}[];
      readonly selectorName: string;
      readonly turn: number;
      readonly total: number;
    }
  | {
      readonly kind: 'qt-question';
      readonly heading: string;
      readonly category: string;
      readonly points: number;
      readonly publicPrompt: string;
      readonly selectorName: string;
      readonly respondingName: string;
      readonly steal: boolean;
    }
  | {
      readonly kind: 'qt-answer';
      readonly heading: string;
      readonly category: string;
      readonly points: number;
      readonly publicPrompt: string;
      readonly publishedSolution: string;
    }
  | {
      readonly kind: 'question';
      readonly heading: string;
      readonly publicPrompt: string;
      readonly visibleClues: readonly string[];
    }
  | {
      readonly kind: 'answer';
      readonly heading: string;
      readonly publicPrompt: string;
      readonly publishedSolution: string;
    }
  | {
      readonly kind: 'scores';
      readonly heading: string;
      readonly visibleScores: readonly { name: string; value: number }[];
    };
export interface PublicStageDto {
  readonly protocolVersion: 1;
  readonly eventId: string;
  readonly gameId: string | null;
  readonly stageRevision: number;
  readonly hostEpoch: number;
  readonly scene: PublicStageScene;
}
export interface PrivateTaskProjection {
  readonly heading: string;
  readonly prompt: string;
  readonly clues: readonly string[];
  readonly answerKey: readonly string[];
  readonly privateNotes?: string;
  readonly visibleClueCount: number;
  readonly solutionPublished: boolean;
}
export function projectTaskForAudience(task: PrivateTaskProjection): PublicStageScene {
  const count = Number.isFinite(task.visibleClueCount) ? Math.trunc(task.visibleClueCount) : 0;
  const visible = task.clues.slice(0, Math.max(0, Math.min(count, task.clues.length)));
  if (task.solutionPublished) {
    const solution = task.answerKey[0];
    if (!solution) throw new Error('Published task lacks solution');
    return { kind: 'answer', heading: task.heading, publicPrompt: task.prompt, publishedSolution: solution };
  }
  return { kind: 'question', heading: task.heading, publicPrompt: task.prompt, visibleClues: visible };
}
export function waitingScene(): PublicStageScene {
  return { kind: 'waiting', heading: 'Warte auf die Spielleitung' };
}
