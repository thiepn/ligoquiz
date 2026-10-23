import {createDraft,type ContentItem} from './contracts';
import {G10_EXPORT_FORMAT} from './migration';
import {RQ_TRIAL_BANK} from '../games/rundenquiz/trial-bank';
import {sampleQuiztafel} from '../games/quiztafel/trial-bank';
import {trialVerbindungen} from '../games/verbindungen/trial-bank';
import {trialLogikleiter} from '../games/logikleiter/trial-bank';
import {trialUmfrageduell} from '../games/umfrageduell/trial-bank';
import type {GameType} from '../domain/game/contracts';

export const TRIAL_DRAFT_SOURCE='v2-original-trial-banks-v2';
const teams=Array.from({length:5},(_,i)=>({id:'trial-'+(i+1),name:'Team '+(i+1),order:i}));

/** Pure, stable source snapshot. No storage writes, certification or automatic approvals. */
export function trialDraftItems():ContentItem[]{
 const board=sampleQuiztafel('lang',teams);
 const entries:{game:GameType;payload:unknown;sourceKey:string}[]=[
  ...RQ_TRIAL_BANK.map(payload=>({game:'rundenquiz' as const,payload,sourceKey:'src/games/rundenquiz/trial-bank.ts'})),
  ...board.tiles.map(tile=>({game:'quiztafel' as const,payload:{
   ...tile,categoryName:board.categories.find(c=>c.id===tile.categoryId)!.name},
   sourceKey:'src/games/quiztafel/trial-bank.ts'})),
  ...trialVerbindungen('lang',teams).map(payload=>({game:'verbindungen' as const,payload,
   sourceKey:'src/games/verbindungen/trial-bank.ts'})),
  ...trialLogikleiter('lang').map(payload=>({game:'logikleiter' as const,payload,
   sourceKey:'src/games/logikleiter/trial-bank.ts'})),
  ...trialUmfrageduell('lang').map(payload=>({game:'umfrageduell' as const,payload,
   sourceKey:'src/games/umfrageduell/trial-bank.ts'})),
 ];
 return entries.map(({game,payload,sourceKey})=>{
  const item=createDraft(game,payload,0);
  return {...item,provenance:{origin:'sample' as const,sourceKey,sourceId:item.id,sourceVersion:TRIAL_DRAFT_SOURCE,
   reviewHint:'Ungeprüfte Probeaufgabe: Fakten, Antwort, Quelle und Rechte selbst prüfen'},
   audit:[{revision:0,at:0,action:'SAMPLE_DRAFT',
    note:'Vorhandene Probeaufgabe als redaktioneller Entwurf; nicht freigegeben'}]};
 });
}

/** Feed the existing G10 preview, quarantine, receipt, CAS and guarded undo flow. */
export function trialDraftBundle():string{
 return JSON.stringify({format:G10_EXPORT_FORMAT,version:1,source:TRIAL_DRAFT_SOURCE,
  entries:trialDraftItems()});
}
