import type {ContentItem} from '../../content/contracts';
import {coverage,selectReviewedPack} from '../../content/contracts';
import {sha256} from '../../content/migration';
import {GAME_TYPES,type GameProfile,type GameType} from '../../domain/game/contracts';

export type ApprovedChoice={game:GameType;profile:GameProfile;teams:3|4|5;ready:boolean;reason:string;
 missing:readonly string[]};
export type ApprovedProgramInventory={choices:readonly ApprovedChoice[];approvedCount:number;
 invalidFingerprints:number;usableCount:number};
const profiles:readonly GameProfile[]=['kurz','standard','lang'];
const teamCounts=[3,4,5] as const;

/** Delegates to the SAME canonical selector used by createPreparedApproved. */
function selectOriginalPack(items:readonly ContentItem[],game:GameType,profile:GameProfile,teams:number):void{
 switch(game){
  case 'rundenquiz':void selectReviewedPack(items,'rundenquiz',profile,teams);break;
  case 'quiztafel':void selectReviewedPack(items,'quiztafel',profile,teams);break;
  case 'verbindungen':void selectReviewedPack(items,'verbindungen',profile,teams);break;
  case 'logikleiter':void selectReviewedPack(items,'logikleiter',profile,teams);break;
  case 'umfrageduell':void selectReviewedPack(items,'umfrageduell',profile,teams);break;
 }
}
function missingFor(items:readonly ContentItem[],game:GameType,profile:GameProfile,teams:number):string[]{
 const {required,available}=coverage(items,game,profile,teams);
 return Object.entries(required).filter(([kind,count])=>(available[kind]??0)<count)
  .map(([kind,count])=>kind+': '+(available[kind]??0)+' / '+count);
}
export function evaluateApprovedChoices(items:readonly ContentItem[]):ApprovedChoice[]{
 const choices:ApprovedChoice[]=[];
 for(const game of GAME_TYPES)for(const profile of profiles)for(const teams of teamCounts){
  const missing=missingFor(items,game,profile,teams);
  let reason='',ready=false;
  if(missing.length)reason='Freigegebene Aufgaben fehlen';
  else try{selectOriginalPack(items,game,profile,teams);ready=true;}
   catch(e){reason=e instanceof Error?e.message:'Originale Paketprüfung fehlgeschlagen';}
  choices.push({game,profile,teams,ready,reason,missing});
 }
 return choices;
}
/** Same SHA-256 approval-fingerprint contract as actual approved event freeze.
 * Pending/review/quarantined and tampered approvals can NEVER qualify.
 * No database writes or synthetic source material. */
export async function assessApprovedPrograms(items:readonly ContentItem[]):Promise<ApprovedProgramInventory>{
 const verified:ContentItem[]=[];
 let invalidFingerprints=0,approvedCount=0;
 for(const item of items){
  if(item.status!=='approved')continue;
  approvedCount++;
  if(!item.review){invalidFingerprints++;continue;}
  try{
   if(await sha256(JSON.stringify(item.payload))!==item.review.fingerprint){invalidFingerprints++;continue;}
   verified.push(item);
  }catch{invalidFingerprints++;}
 }
 const choices=evaluateApprovedChoices(verified);
 return {choices,approvedCount,invalidFingerprints,usableCount:choices.filter(c=>c.ready).length};
}
export function matchingApprovedChoice(inventory:ApprovedProgramInventory,
 game:GameType,profile:GameProfile,teams:3|4|5):ApprovedChoice|null{
 return inventory.choices.find(c=>c.game===game&&c.profile===profile&&c.teams===teams)??null;
}
