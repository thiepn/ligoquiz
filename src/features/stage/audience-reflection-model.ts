import type {ViewerState} from './stage-viewer';
import {audienceRound,retainedGuess,type LocalGuess} from './audience-playalong-model';

export type SelfReflectionChoice='matched'|'partial'|'different';
export type LocalReflection={
 eventId:string;gameId:string|null;hostEpoch:number;key:string;
 choice:SelfReflectionChoice;
};
export type RevealedComparison={
 guess:string;published:readonly string[];reflection:LocalReflection|null;
};
const CHOICES:readonly SelfReflectionChoice[]=['matched','partial','different'];

/**
 * The spectator's own manual reflection, NEVER an answer grader.
 * Compare only an ALREADY-LOCKED note with a genuine PUBLIC reveal.
 * Neither the question text nor unpublished sources/answers enter this model.
 */
export function revealedComparison(view:ViewerState,guess:LocalGuess|null,
 reflection:LocalReflection|null):RevealedComparison|null{
 if(view.status!=='live'||!view.frame||!guess?.locked)return null;
 if(!retainedGuess(guess,view))return null;
 const round=audienceRound(view.frame.scene,guess.key);
 if(round.kind!=='reveal'||round.key!==guess.key||round.published.length===0)return null;
 return {guess:guess.text,published:round.published,
  reflection:retainedReflection(reflection,view,guess)};
}
export function retainedReflection(reflection:LocalReflection|null,view:ViewerState,
 guess:LocalGuess|null):LocalReflection|null{
 if(!reflection||!guess?.locked||!retainedGuess(guess,view)||view.status!=='live'||!view.frame)return null;
 const round=audienceRound(view.frame.scene,guess.key);
 if(round.kind!=='reveal'||round.key!==guess.key||round.published.length===0)return null;
 if(reflection.eventId!==guess.eventId||reflection.gameId!==guess.gameId||
  reflection.hostEpoch!==guess.hostEpoch||reflection.key!==guess.key)return null;
 return CHOICES.includes(reflection.choice)?reflection:null;
}
export function chooseReflection(view:ViewerState,guess:LocalGuess|null,
 choice:SelfReflectionChoice):LocalReflection{
 if(!CHOICES.includes(choice))throw Error('Unbekannte Reflexion');
 if(!revealedComparison(view,guess,null)||!guess)throw Error('Keine freigegebene Auflösung zu einem festgehaltenen Tipp');
 return {eventId:guess.eventId,gameId:guess.gameId,hostEpoch:guess.hostEpoch,
  key:guess.key,choice};
}
