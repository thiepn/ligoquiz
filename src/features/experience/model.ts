import type { EventRecord } from '../../domain/event/schemas';
import { createEvent } from '../../domain/event/transition';
import { createSession, scores, eveningHalfPoints, type Profile } from '../../games/rundenquiz/engine';
import { RQ_TRIAL_BANK } from '../../games/rundenquiz/trial-bank';
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

export type SetupDraft = { teams: string[]; count: 3 | 4 | 5; profile: Profile; step: 0 | 1 | 2 };
export function newSetupDraft(preference: Preferences = DEFAULT_PREFERENCES): SetupDraft {
  return { count: preference.defaultTeams, profile: preference.defaultProfile, step: 0,
    teams: ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5'] };
}
export function parseSetupDraft(raw: unknown): SetupDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (![3,4,5].includes(Number(x.count)) || !['kurz','standard','lang'].includes(String(x.profile)) ||
      ![0,1,2].includes(Number(x.step)) || !Array.isArray(x.teams) || x.teams.length !== 5 ||
      x.teams.some(name => typeof name !== 'string' || name.length > 40)) return null;
  return { count: x.count as SetupDraft['count'], profile: x.profile as Profile,
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

export function reportFor(event: EventRecord) {
  const rq=event.rundenquiz;
  if(!rq || rq.phase!=='complete' || event.lifecycle!=='complete') return null;
  const raw=scores(rq), evening=eveningHalfPoints(rq);
  const teams=rq.teams.map(t=>({
    id:t.id,name:t.name,rawPoints:raw[t.id]??0,eveningHalfPoints:evening[t.id]??0,
  })).sort((a,b)=>b.rawPoints-a.rawPoints||a.name.localeCompare(b.name,'de'));
  return {
    schemaVersion:1 as const,id:event.id,finishedAt:event.updatedAt,
    profile:rq.profile,questionCount:rq.questions.length,teams,
    awards:rq.awards.map(a=>({...a})),
    sourceLabel:'G5 Probeinhalte (noch nicht redaktionell freigegeben)',
  };
}
export function safeFileName(id:string) { return 'ligoquiz-bericht-'+id.replace(/[^\w-]/g,'').slice(0,60)+'.json'; }
