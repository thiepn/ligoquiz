import { describe, expect, it } from 'vitest';
import { projectTaskForAudience, waitingScene } from '../src/domain/projection/public-stage';

const PRIVATE_TASK = {
  heading: 'Quizfrage',
  prompt: 'Wer folgte Mose nach?',
  clues: ['Leitete Israel', 'Buch Josua'],
  answerKey: ['Josua'],
  privateNotes: 'ONLY_FOR_HOST',
  visibleClueCount: 1,
  solutionPublished: false,
} as const;

describe('stage data minimization', () => {
  it('never includes unpublished answers, clues or host notes', () => {
    const publicScene = projectTaskForAudience(PRIVATE_TASK);
    expect(publicScene).toEqual({
      kind: 'question', heading: 'Quizfrage',
      publicPrompt: 'Wer folgte Mose nach?', visibleClues: ['Leitete Israel'],
    });
    const text = JSON.stringify(publicScene);
    for (const secret of ['Josua', 'Buch Josua', 'ONLY_FOR_HOST', 'answerKey', 'privateNotes']) {
      expect(text).not.toContain(secret);
    }
  });
  it('publishes answer only after deliberate reveal', () => {
    const publicScene = projectTaskForAudience({ ...PRIVATE_TASK, solutionPublished: true });
    expect(publicScene).toEqual({
      kind: 'answer', heading: 'Quizfrage',
      publicPrompt: 'Wer folgte Mose nach?', publishedSolution: 'Josua',
    });
  });
  it('has a safe default waiting state', () => {
    expect(waitingScene()).toEqual({ kind: 'waiting', heading: 'Warte auf die Spielleitung' });
  });
});
