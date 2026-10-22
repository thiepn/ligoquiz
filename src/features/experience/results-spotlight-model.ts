import type {reportFor} from './model';

export type CompletedReport=NonNullable<ReturnType<typeof reportFor>>;
export type FinishedTeam=CompletedReport['teams'][number];
export type RankedFinishedTeam=FinishedTeam&{rank:number;leader:boolean};

/** Use only original reportFor results, never draft answers or an alternate score
 * ledger. Dense competition rankings match the existing CSV and report views. */
export function rankedFinishedTeams(teams:readonly FinishedTeam[]):RankedFinishedTeam[]{
 const ordered=[...teams].sort((a,b)=>b.rawPoints-a.rawPoints||
   a.name.localeCompare(b.name,'de')||a.id.localeCompare(b.id));
 const leader=ordered[0]?.rawPoints;
 return ordered.map(t=>({...t,
  rank:1+ordered.filter(other=>other.rawPoints>t.rawPoints).length,
  leader:leader!==undefined&&t.rawPoints===leader,
 }));
}
