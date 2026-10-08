import { z } from 'zod';
import { currentQuestion, type Session } from './engine';
export const timerSnapshotSchema=z.strictObject({
 eventId:z.string().min(1).max(128),
 ownerId:z.string().min(1).max(128),
 ownerEpoch:z.number().int().positive(),
 questionId:z.string().min(1).max(128),
 remainingSeconds:z.number().int().min(0).max(300),
 updatedAt:z.number().int().nonnegative().safe(),
});
export type TimerSnapshot=z.infer<typeof timerSnapshotSchema>;
/** Advisory state is never score authority. A restored timer is always stopped. */
export function timerScopeMatches(s:Session,untrusted:unknown):untrusted is TimerSnapshot{
 const parsed=timerSnapshotSchema.safeParse(untrusted);
 if(!parsed.success)return false;
 const snap=parsed.data,q=currentQuestion(s);
 return s.id===snap.eventId && s.ownerId===snap.ownerId && s.epoch===snap.ownerEpoch &&
  s.phase==='open' && !!q && q.id===snap.questionId && snap.remainingSeconds<=q.durationSeconds+300;
}
export function newTimerSnapshot(s:Session,seconds:number):TimerSnapshot{
 const q=currentQuestion(s);
 if(!q||s.phase!=='open')throw new Error('Timer requires an open question');
 return timerSnapshotSchema.parse({
  eventId:s.id,ownerId:s.ownerId,ownerEpoch:s.epoch,questionId:q.id,
  remainingSeconds:seconds,updatedAt:Date.now(),
 });
}
