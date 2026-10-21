import type {ContentItem} from '../../content/contracts';
import {selectReviewedPack,validatePayload} from '../../content/contracts';
import {sha256} from '../../content/migration';
import {DEPTH,type Profile,type Tile} from '../../games/quiztafel/engine';

export type QuiztafelChoice=Pick<Tile,'id'|'categoryId'|'row'|'value'|'prompt'> & {categoryName:string};
export type QuiztafelInventory={tiles:readonly QuiztafelChoice[];excluded:number};
export type QuiztafelBoardStatus={
 exact:boolean;selected:number;needed:number;categories:number;categoryLimit:number;
 cells:readonly {categoryId:string;row:number;selected:number}[];
};

/** Only currently approved, exact-review-digest source questions may enter the host's board composer. */
export async function reviewedQuiztafelChoices(items:readonly ContentItem[]):Promise<QuiztafelInventory>{
 const tiles:QuiztafelChoice[]=[];let excluded=0;
 for(const item of items){
  if(item.game!=='quiztafel')continue;
  if(item.status!=='approved'||!item.review||validatePayload('quiztafel',item.payload).length){
   excluded++;continue;
  }
  try{
   if(await sha256(JSON.stringify(item.payload))!==item.review.fingerprint){excluded++;continue;}
  }catch{excluded++;continue;}
  const t=item.payload as Tile & {categoryName:string};
  if(item.id!==t.id){excluded++;continue;}
  tiles.push({id:t.id,categoryId:t.categoryId,categoryName:t.categoryName,
   row:t.row,value:t.value,prompt:t.prompt});
 }
 return {tiles,excluded};
}

/** Manual selection must fill exactly one original 100-600 cell per category, for exactly N teams. */
export function selectedQuiztafelBoardStatus(profile:Profile,teams:3|4|5,
 choices:readonly QuiztafelChoice[],ids:readonly string[]):QuiztafelBoardStatus{
 const selected=choices.filter(tile=>ids.includes(tile.id)),categories=[...new Set(selected.map(t=>t.categoryId))];
 const cells=categories.flatMap(categoryId=>Array.from({length:DEPTH[profile]},(_,i)=>({
  categoryId,row:i+1,selected:selected.filter(t=>t.categoryId===categoryId&&t.row===i+1).length,
 })));
 const uniqueNames=new Set(categories.map(id=>selected.find(t=>t.categoryId===id)?.categoryName
  .trim().toLocaleLowerCase('de-DE')));
 const namesConsistent=categories.every(id=>new Set(selected.filter(t=>t.categoryId===id)
  .map(t=>t.categoryName)).size===1);
 const needed=teams*DEPTH[profile];
 return {exact:ids.length===needed&&selected.length===needed&&
   new Set(ids).size===ids.length&&categories.length===teams&&
   namesConsistent&&uniqueNames.size===categories.length&&cells.every(c=>c.selected===1),
  selected:ids.length,needed,categories:categories.length,categoryLimit:teams,cells};
}

/** The same original selector/verifyBoard and later original source-SHA freeze remain decisive. */
export function selectedReviewedQuiztafelBoard(items:readonly ContentItem[],profile:Profile,
 teams:3|4|5,ids:readonly string[]){
 if(ids.length!==teams*DEPTH[profile]||ids.length>30||new Set(ids).size!==ids.length)
  throw Error('Quiztafel-Auswahl unvollständig oder doppelt');
 const order=new Set(ids);
 const only=items.filter(i=>i.game==='quiztafel'&&i.status==='approved'&&order.has(i.id));
 if(only.length!==ids.length)throw Error('Ausgewählte Quiztafel-Frage nicht mehr freigegeben');
 const board=selectReviewedPack(only,'quiztafel',profile,teams);
 if(board.tiles.length!==ids.length||board.tiles.some(t=>!order.has(t.id)))
  throw Error('Quiztafel-Auswahl entspricht nicht dem Original-Spielfeld');
 return board;
}
