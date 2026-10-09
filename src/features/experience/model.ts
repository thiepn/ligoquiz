import type { EventRecord } from '../../domain/event/schemas';
import { createEvent } from '../../domain/event/transition';
import { createSession, scores, eveningHalfPoints, type Profile } from '../../games/rundenquiz/engine';
import { RQ_TRIAL_BANK } from '../../games/rundenquiz/trial-bank';
import { createSession as createQuiztafel, scores as quiztafelScores,
  eveningHalfPoints as quiztafelEvening } from '../../games/quiztafel/engine';
import { sampleQuiztafel } from '../../games/quiztafel/trial-bank';
import { createSession as createVerbindungen, scores as verbindungenScores,
 eveningHalfPoints as verbindungenEvening } from '../../games/verbindungen/engine';
import { trialVerbindungen } from '../../games/verbindungen/trial-bank';
import {createSession as createLogikleiter,scores as logikleiterScores,eveningHalfPoints as logikleiterEvening} from '../../games/logikleiter/engine';
import {trialLogikleiter} from '../../games/logikleiter/trial-bank';
import {createSession as createUmfrageduell,scores as umfrageduellScores,eveningHalfPoints as umfrageduellEvening} from '../../games/umfrageduell/engine';
import {trialUmfrageduell} from '../../games/umfrageduell/trial-bank';
import type { EventRepository } from '../../infrastructure/db/event-repository';

export const HOST_IDENTITY_KEY = 'ligoquiz.v2.g4.rundenquiz.host';
const PREFERENCES_KEY = 'ligoquiz.v2.preferences.v1';
const DRAFT_KEY = 'ligoquiz.v2.setup-draft.v1';

export type HostIdentity = { eventId: string; hostId: string };
export type Preferences = {
  defaultTeams: 3 | 4 | 5;
  defaultProfile: Profile;
  motion: 'system' | 'reduce' | 'full';
};
export const DEFAULT_PREFERENCES: Preferences = {
  defaultTeams: 4, defaultProfile: 'kurz', motion: 'system',
};

function storageGet(storage: Storage | undefined, key: string): unknown {
  try { return JSON.parse(storage?.getItem(key) ?? 'null'); } catch { return null; }
}
export function readHostIdentity(): HostIdentity | null {
  const v = storageGet(typeof sessionStorage === 'undefined' ? undefined : sessionStorage, HOST_IDENTITY_KEY);
  if (!v || typeof v !== 'object' || !('hostId' in v) || !('eventId' in v)) return null;
  const a = v as Record<string, unknown>;
  if (typeof a.hostId !== 'string' || typeof a.eventId !== 'string' ||
      !/^[\w-]{8,128}$/.test(a.hostId) || !/^[\w-]{8,128}$/.test(a.eventId)) return null;
  return { hostId: a.hostId, eventId: a.eventId };
}
export function writeHostIdentity(value: HostIdentity): void {
  sessionStorage.setItem(HOST_IDENTITY_KEY, JSON.stringify(value));
}
export function clearHostIdentity(): void {
  try { sessionStorage.removeItem(HOST_IDENTITY_KEY); } catch { /* restricted storage */ }
}

export function parsePreferences(raw: unknown): Preferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFERENCES;
  const p = raw as Record<string, unknown>;
  return {
    defaultTeams: [3, 4, 5].includes(Number(p.defaultTeams))
      ? Number(p.defaultTeams) as 3 | 4 | 5 : 4,
    defaultProfile: p.defaultProfile === 'standard' || p.defaultProfile === 'lang' ? p.defaultProfile : 'kurz',
    motion: p.motion === 'reduce' || p.motion === 'full' ? p.motion : 'system',
  };
}
export function readPreferences(): Preferences {
  return parsePreferences(storageGet(typeof localStorage === 'undefined' ? undefined : localStorage, PREFERENCES_KEY));
}
export function savePreferences(value: Preferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(parsePreferences(value)));
  applyMotionPreference(value.motion);
}
export function applyMotionPreference(motion: Preferences['motion']): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.ligoMotion = motion;
}

export type SetupDraft = { teams: string[]; count: 3 | 4 | 5; profile: Profile; game: 'rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell'; contentSource:'trial'|'approved';step: 0 | 1 | 2 };
export function newSetupDraft(preference: Preferences = DEFAULT_PREFERENCES): SetupDraft {
  return { count: preference.defaultTeams, profile: preference.defaultProfile, game:'rundenquiz', contentSource:'trial',step: 0,
    teams: ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5'] };
}
export function parseSetupDraft(raw: unknown): SetupDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (![3,4,5].includes(Number(x.count)) || !['kurz','standard','lang'].includes(String(x.profile)) ||
      ![0,1,2].includes(Number(x.step)) || !Array.isArray(x.teams) || x.teams.length !== 5 ||
      x.teams.some(name => typeof name !== 'string' || name.length > 40)) return null;
  return { count: x.count as SetupDraft['count'], profile: x.profile as Profile,
    game:x.game==='quiztafel'?'quiztafel':x.game==='verbindungen'?'verbindungen':x.game==='logikleiter'?'logikleiter':x.game==='umfrageduell'?'umfrageduell':'rundenquiz',
    contentSource:x.contentSource==='approved'?'approved':'trial',
    step: x.step as SetupDraft['step'], teams: [...x.teams] as string[] };
}
export function readSetupDraft(): SetupDraft | null {
  return parseSetupDraft(storageGet(typeof localStorage === 'undefined' ? undefined : localStorage, DRAFT_KEY));
}
export function saveSetupDraft(draft: SetupDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
export function clearSetupDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage may be disabled */ }
}

export async function createPreparedRundenquiz(
  repo: EventRepository, draft: Pick<SetupDraft, 'teams'|'count'|'profile'>,
): Promise<HostIdentity> {
  const eventId = crypto.randomUUID(), hostId = crypto.randomUUID();
  const teams = draft.teams.slice(0,draft.count).map((name,i) => ({
    id: 'rq-team-' + (i+1), order: i, name: name.trim(), colorToken: 'team-' + (i+1),
  }));
  const rq = createSession({
    id: eventId, ownerId: hostId, profile: draft.profile,
    teams: teams.map(({id,name,order})=>({id,name,order})),bank: RQ_TRIAL_BANK,
  });
  const event = createEvent({
    id: eventId, hostId, at: Date.now(),
    teams, program: [{id:'rq-game-1', type:'rundenquiz', profile:draft.profile, order:0, rulesVersion:'rq-trial-1'}],
    frozenTasks: rq.questions.map(q=>({
      taskId:q.id,gameType:'rundenquiz' as const,publicPrompt:q.prompt,
      publicClues:[...(q.clues??[])],privateAnswers:[q.answer],
      moderatorNotes:'G5 Probeinhalte: '+q.reference,
      sourceContentId:q.id,sourceHash:'g5-trial-v1',
    })), rundenquiz:rq,
  });
  await repo.create(event);
  return { eventId, hostId };
}

export async function createPreparedQuiztafel(
  repo:EventRepository,draft:Pick<SetupDraft,'teams'|'count'|'profile'>,
):Promise<HostIdentity>{
  const eventId=crypto.randomUUID(),hostId=crypto.randomUUID();
  const teams=draft.teams.slice(0,draft.count).map((name,i)=>({
    id:'qt-team-'+(i+1),order:i,name:name.trim(),colorToken:'team-'+(i+1),
  }));
  const board=sampleQuiztafel(draft.profile,teams);
  const qt=createQuiztafel({
    id:eventId,ownerId:hostId,profile:draft.profile,
    teams:teams.map(({id,name,order})=>({id,name,order})),...board,
  });
  const event=createEvent({
    id:eventId,hostId,at:Date.now(),
    teams,program:[{id:'qt-game-1',type:'quiztafel',profile:draft.profile,order:0,rulesVersion:'qt-trial-1'}],
    frozenTasks:qt.tiles.map(tile=>({
      taskId:tile.id,gameType:'quiztafel' as const,publicPrompt:tile.prompt,
      publicClues:[],privateAnswers:[tile.answer],
      moderatorNotes:'G6 Probeinhalte: '+tile.reference,
      sourceContentId:tile.id,sourceHash:'g6-trial-v1',
    })),quiztafel:qt,
  });
  await repo.create(event);
  return {eventId,hostId};
}

export async function createPreparedVerbindungen(
 repo:EventRepository,draft:Pick<SetupDraft,'teams'|'count'|'profile'>,
):Promise<HostIdentity>{
 const eventId=crypto.randomUUID(),hostId=crypto.randomUUID();
 const teams=draft.teams.slice(0,draft.count).map((name,i)=>({
   id:'vb-team-'+(i+1),order:i,name:name.trim(),colorToken:'team-'+(i+1),
 }));
 const puzzles=trialVerbindungen(draft.profile,teams);
 const vb=createVerbindungen({
   id:eventId,ownerId:hostId,profile:draft.profile,
   teams:teams.map(({id,name,order})=>({id,name,order})),puzzles,
 });
 const event=createEvent({
   id:eventId,hostId,at:Date.now(),
   teams,program:[{id:'vb-game-1',type:'verbindungen',profile:draft.profile,order:0,rulesVersion:'vb-trial-1'}],
   frozenTasks:puzzles.map(p=>({
     taskId:p.id,gameType:'verbindungen' as const,
     publicPrompt:p.kind==='clues'?'Vier Hinweise':p.kind==='sequence'?p.prompt:'Verbindungswand',
     publicClues:p.kind==='clues'?[...p.clues]:[],
     privateAnswers:p.kind==='clues'?[p.target]:p.kind==='sequence'?[p.answer]:
       p.groups.map(g=>g.link+' / '+g.tileIds.join(', ')),
     moderatorNotes:'G7 Probeinhalt – Quelle: '+p.reference,
     sourceContentId:p.id,sourceHash:'g7-trial-v1',
   })),verbindungen:vb,
 });
 await repo.create(event);
 return {eventId,hostId};
}

export async function createPreparedLogikleiter(
 repo:EventRepository,draft:Pick<SetupDraft,'teams'|'count'|'profile'>,
):Promise<HostIdentity>{
 const eventId=crypto.randomUUID(),hostId=crypto.randomUUID();
 const teams=draft.teams.slice(0,draft.count).map((name,i)=>({
  id:'ll-team-'+(i+1),order:i,name:name.trim(),colorToken:'team-'+(i+1),
 }));
 const rungs=trialLogikleiter(draft.profile);
 const ll=createLogikleiter({id:eventId,ownerId:hostId,profile:draft.profile,
  teams:teams.map(({id,name,order})=>({id,name,order})),rungs});
 const event=createEvent({
  id:eventId,hostId,at:Date.now(),teams,
  program:[{id:'ll-game-1',type:'logikleiter',profile:draft.profile,order:0,rulesVersion:'ll-trial-1'}],
  frozenTasks:rungs.map(r=>({
   taskId:r.id,gameType:'logikleiter' as const,publicPrompt:r.prompt,
   publicClues:[r.hint],privateAnswers:[r.answer],
   moderatorNotes:'G8 Probeinhalt: '+r.explanation+' / '+r.reference,
   sourceContentId:r.id,sourceHash:'g8-trial-v1',
  })),logikleiter:ll,
 });
 await repo.create(event);return {eventId,hostId};
}

export async function createPreparedUmfrageduell(
 repo:EventRepository,draft:Pick<SetupDraft,'teams'|'count'|'profile'>,
):Promise<HostIdentity>{
 const eventId=crypto.randomUUID(),hostId=crypto.randomUUID();
 const teams=draft.teams.slice(0,draft.count).map((name,i)=>({
  id:'ud-team-'+(i+1),order:i,name:name.trim(),colorToken:'team-'+(i+1),
 }));
 const surveys=trialUmfrageduell(draft.profile);
 const ud=createUmfrageduell({id:eventId,ownerId:hostId,profile:draft.profile,
  teams:teams.map(({id,name,order})=>({id,name,order})),surveys});
 const event=createEvent({
  id:eventId,hostId,at:Date.now(),teams,
  program:[{id:'ud-game-1',type:'umfrageduell',profile:draft.profile,order:0,rulesVersion:'ud-trial-1'}],
  frozenTasks:surveys.map(q=>({
   taskId:q.id,gameType:'umfrageduell' as const,publicPrompt:q.prompt,publicClues:[],
   privateAnswers:q.categories.map(c=>c.label),
   moderatorNotes:'G9 illustrative example data; not a measured survey',
   sourceContentId:q.id,sourceHash:'g9-illustrative-v1',
  })),umfrageduell:ud,
 });
 await repo.create(event);return {eventId,hostId};
}

export function reportFor(event: EventRecord) {
 const ud=event.umfrageduell;
 if(ud&&ud.phase==='complete'&&event.lifecycle==='complete'){
  const raw=umfrageduellScores(ud),evening=umfrageduellEvening(ud);
  return {
   schemaVersion:1 as const,id:event.id,finishedAt:event.updatedAt,
   gameLabel:'Umfrageduell',profile:ud.profile,questionCount:ud.surveys.length,
   teams:ud.teams.map(t=>({id:t.id,name:t.name,rawPoints:raw[t.id]??0,
    eveningHalfPoints:evening[t.id]??0}))
    .sort((a,b)=>b.rawPoints-a.rawPoints||a.name.localeCompare(b.name,'de')),
   awards:ud.awards.map(a=>({...a})),
   sourceLabel:'G9 Beispieldaten – keine echte Umfrage',
  };
 }
 const ll=event.logikleiter;
 if(ll&&ll.phase==='complete'&&event.lifecycle==='complete'){
  const raw=logikleiterScores(ll),evening=logikleiterEvening(ll);
  return {
   schemaVersion:1 as const,id:event.id,finishedAt:event.updatedAt,
   gameLabel:'Logikleiter',profile:ll.profile,questionCount:ll.rungs.length,
   teams:ll.teams.map(t=>({id:t.id,name:t.name,rawPoints:raw[t.id]??0,
    eveningHalfPoints:evening[t.id]??0}))
    .sort((a,b)=>b.rawPoints-a.rawPoints||a.name.localeCompare(b.name,'de')),
   awards:ll.awards.map(a=>({...a})),
   sourceLabel:'G8 Probeinhalte (noch nicht redaktionell freigegeben)',
  };
 }
 const vb=event.verbindungen;
 if(vb&&vb.phase==='complete'&&event.lifecycle==='complete'){
   const raw=verbindungenScores(vb),evening=verbindungenEvening(vb);
   return {
     schemaVersion:1 as const,id:event.id,finishedAt:event.updatedAt,
     gameLabel:'Verbindungen',profile:vb.profile,questionCount:vb.assignments.length,
     teams:vb.teams.map(t=>({id:t.id,name:t.name,rawPoints:raw[t.id]??0,
       eveningHalfPoints:evening[t.id]??0}))
       .sort((a,b)=>b.rawPoints-a.rawPoints||a.name.localeCompare(b.name,'de')),
     awards:vb.awards.map(a=>({...a})),
     sourceLabel:'G7 Probeinhalte (noch nicht redaktionell freigegeben)',
   };
 }
  const qt=event.quiztafel;
  if(qt && qt.phase==='complete' && event.lifecycle==='complete'){
    const raw=quiztafelScores(qt),evening=quiztafelEvening(qt);
    return {
      schemaVersion:1 as const,id:event.id,finishedAt:event.updatedAt,
      gameLabel:'Quiztafel',profile:qt.profile,questionCount:qt.tiles.length,
      teams:qt.teams.map(t=>({id:t.id,name:t.name,rawPoints:raw[t.id]??0,
        eveningHalfPoints:evening[t.id]??0}))
        .sort((a,b)=>b.rawPoints-a.rawPoints||a.name.localeCompare(b.name,'de')),
      awards:qt.outcomes.map(o=>({...o})),
      sourceLabel:'G6 Probeinhalte (noch nicht redaktionell freigegeben)',
    };
  }
  const rq=event.rundenquiz;
  if(!rq || rq.phase!=='complete' || event.lifecycle!=='complete') return null;
  const raw=scores(rq), evening=eveningHalfPoints(rq);
  const teams=rq.teams.map(t=>({
    id:t.id,name:t.name,rawPoints:raw[t.id]??0,eveningHalfPoints:evening[t.id]??0,
  })).sort((a,b)=>b.rawPoints-a.rawPoints||a.name.localeCompare(b.name,'de'));
  return {
    schemaVersion:1 as const,id:event.id,finishedAt:event.updatedAt,
    gameLabel:'Rundenquiz',profile:rq.profile,questionCount:rq.questions.length,teams,
    awards:rq.awards.map(a=>({...a})),
    sourceLabel:'G5 Probeinhalte (noch nicht redaktionell freigegeben)',
  };
}
export function safeFileName(id:string) { return 'ligoquiz-bericht-'+id.replace(/[^\w-]/g,'').slice(0,60)+'.json'; }
