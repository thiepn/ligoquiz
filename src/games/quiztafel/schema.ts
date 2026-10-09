import { z } from 'zod';
import type { Session } from './engine';
import { verifyBoard, DEPTH } from './engine';
const id=z.string().min(1).max(128);
const ordinal=z.number().int().nonnegative().safe();
const team=z.strictObject({id,name:z.string().min(1).max(40),order:ordinal});
const category=z.strictObject({id,name:z.string().min(1).max(55)});
const tile=z.strictObject({
  id,categoryId:id,row:z.number().int().min(1).max(6),value:z.number().int().min(100).max(600),
  prompt:z.string().min(1).max(3000),answer:z.string().min(1).max(2000),reference:z.string().min(1).max(2000),
});
const outcome=z.strictObject({
  tileId:id,selectorId:id,stealerId:id.nullable(),winnerId:id.nullable(),
  points:z.number().int().min(0).max(600),annulled:z.boolean(),
});
const audit=z.strictObject({revision:ordinal,commandId:id,type:z.string().min(1),at:ordinal});
const shape=z.strictObject({
  id,ownerId:id,epoch:z.number().int().positive(),revision:ordinal,
  profile:z.enum(['kurz','standard','lang']),
  teams:z.array(team).min(3).max(5),categories:z.array(category).min(3).max(5),tiles:z.array(tile).min(9).max(30),
  phase:z.enum(['setup','board','prepared','question','steal-offer','steal','adjudicated','revealed','awarded','complete']),
  paused:z.boolean(),turn:ordinal,selectedTileId:id.nullable(),
  usedTileIds:z.array(id),primaryResult:z.enum(['correct','wrong','none']).nullable(),
  stealResult:z.enum(['correct','wrong','none','declined']).nullable(),
  candidate:z.enum(['selector','stealer','none']).nullable(),annulled:z.boolean(),
  outcomes:z.array(outcome),audit:z.array(audit),
}).superRefine((s,ctx)=>{
  try { verifyBoard(s); }catch(e){ctx.addIssue({code:'custom',path:['tiles'],message:e instanceof Error?e.message:'Invalid board'});}
  if(s.turn>s.tiles.length)ctx.addIssue({code:'custom',path:['turn'],message:'Turn > tiles'});
  if(s.turn===s.tiles.length&&s.phase!=='complete')ctx.addIssue({code:'custom',path:['phase'],message:'Finished turns must end'});
  if(s.phase==='complete'&&s.usedTileIds.length!==s.tiles.length)ctx.addIssue({code:'custom',path:['phase'],message:'Incomplete finish'});
  if(new Set(s.usedTileIds).size!==s.usedTileIds.length||s.usedTileIds.some(x=>!s.tiles.some(t=>t.id===x)))
    ctx.addIssue({code:'custom',path:['usedTileIds'],message:'Invalid played tiles'});
  if(s.outcomes.length!==s.usedTileIds.length||new Set(s.outcomes.map(x=>x.tileId)).size!==s.outcomes.length)
    ctx.addIssue({code:'custom',path:['outcomes'],message:'Exactly one outcome per played tile'});
  if(s.outcomes.some(o=>!s.usedTileIds.includes(o.tileId)))
    ctx.addIssue({code:'custom',path:['outcomes'],message:'Outcome without played tile'});
  if(s.selectedTileId&&!s.tiles.some(t=>t.id===s.selectedTileId))
    ctx.addIssue({code:'custom',path:['selectedTileId'],message:'Missing selected tile'});
  if(s.outcomes.some(o=>{
    const tile=s.tiles.find(t=>t.id===o.tileId);
    return !tile||o.points!==(o.winnerId?tile.value:0)||
      !s.teams.some(t=>t.id===o.selectorId)||
      (o.stealerId&&!s.teams.some(t=>t.id===o.stealerId))||
      (o.winnerId&&!s.teams.some(t=>t.id===o.winnerId));
  }))ctx.addIssue({code:'custom',path:['outcomes'],message:'Invalid award'});
  if(s.selectedTileId&&s.phase==='board')ctx.addIssue({code:'custom',path:['phase'],message:'Board must not expose prepared selection'});
  if(s.usedTileIds.length!==s.turn+(s.phase==='awarded'?1:0))
    ctx.addIssue({code:'custom',path:['usedTileIds'],message:'Selector turns and completed tiles diverged'});
  if(s.phase==='complete'&&s.selectedTileId!==null)
    ctx.addIssue({code:'custom',path:['selectedTileId'],message:'Completed board retains tile'});
  if(s.phase==='prepared'&&!s.selectedTileId)
    ctx.addIssue({code:'custom',path:['selectedTileId'],message:'Prepared tile missing'});
  if(!s.selectedTileId&&!['setup','board','complete'].includes(s.phase))
    ctx.addIssue({code:'custom',path:['selectedTileId'],message:'Active tile missing'});
  if(DEPTH[s.profile]*s.teams.length!==s.tiles.length)
    ctx.addIssue({code:'custom',path:['tiles'],message:'Wrong profile board size'});
});
export const qtSessionSchema=z.custom<Session>(v=>shape.safeParse(v).success,'Invalid Quiztafel snapshot');
const result=z.enum(['correct','wrong','none']);
export const qtActionSchema=z.discriminatedUnion('type',[
  z.strictObject({type:z.literal('START')}),
  z.strictObject({type:z.literal('PICK'),tileId:id}),
  z.strictObject({type:z.literal('UNPICK')}),
  z.strictObject({type:z.literal('PUBLISH')}),
  z.strictObject({type:z.literal('PRIMARY'),result}),
  z.strictObject({type:z.literal('OFFER_STEAL')}),
  z.strictObject({type:z.literal('STEAL'),result:z.enum(['correct','wrong','none','declined'])}),
  z.strictObject({type:z.literal('REVEAL')}),
  z.strictObject({type:z.literal('ADJUST'),winner:z.enum(['selector','stealer','none'])}),
  z.strictObject({type:z.literal('CONFIRM')}),
  z.strictObject({type:z.literal('CORRECT')}),
  z.strictObject({type:z.literal('ANNUL'),reason:z.string().trim().min(3).max(500)}),
  z.strictObject({type:z.literal('NEXT')}),
  z.strictObject({type:z.literal('PAUSE')}),
  z.strictObject({type:z.literal('RESUME')}),
]);
