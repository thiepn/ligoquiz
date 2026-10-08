/** BP-05 domain contract. All five rules engines will implement this port in G4–G9. */
export const GAME_TYPES = [
  'rundenquiz', 'quiztafel', 'verbindungen', 'logikleiter', 'umfrageduell',
] as const;

export type GameType = (typeof GAME_TYPES)[number];
export type GameProfile = 'kurz' | 'standard' | 'lang';
export type EventLifecycle = 'draft' | 'ready' | 'active' | 'paused' | 'between'
  | 'final-review' | 'complete' | 'abandoned';
export type UnitPhase = 'preparing' | 'presenting' | 'revealed' | 'resolved';

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type TeamId = Brand<string, 'TeamId'>;
export type EventId = Brand<string, 'EventId'>;
export type GameInstanceId = Brand<string, 'GameInstanceId'>;
export type TaskInstanceId = Brand<string, 'TaskInstanceId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type OutcomeId = Brand<string, 'OutcomeId'>;

export interface Team {
  readonly id: TeamId;
  readonly order: number;
  readonly name: string;
  readonly colorToken: string;
}
export interface GameInstance {
  readonly id: GameInstanceId;
  readonly type: GameType;
  readonly profile: GameProfile;
  readonly order: number;
  readonly rulesVersion: string;
}
export interface FrozenTask {
  readonly taskId: TaskInstanceId;
  readonly gameType: GameType;
  readonly publicPrompt: string;
  readonly publicClues: readonly string[];
  readonly privateAnswers: readonly string[];
  readonly moderatorNotes?: string;
  readonly sourceContentId: string;
  readonly sourceHash: string;
}
export interface EventAggregate {
  readonly id: EventId;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly hostEpoch: number;
  readonly lifecycle: EventLifecycle;
  readonly teams: readonly Team[];
  readonly program: readonly GameInstance[];
  readonly frozenTasks: readonly FrozenTask[];
}
export type HostCommand =
  | { readonly type: 'EVENT_START' }
  | { readonly type: 'EVENT_PAUSE' }
  | { readonly type: 'EVENT_RESUME' }
  | { readonly type: 'TASK_PUBLISH'; readonly taskId: TaskInstanceId }
  | { readonly type: 'HINT_PUBLISH'; readonly taskId: TaskInstanceId; readonly clueIndex: number }
  | { readonly type: 'SOLUTION_PUBLISH'; readonly taskId: TaskInstanceId }
  | { readonly type: 'OUTCOME_COMMIT'; readonly outcomeId: OutcomeId }
  | { readonly type: 'NEXT_TASK' };
export interface CommandEnvelope {
  readonly protocolVersion: 1;
  readonly commandId: CommandId;
  readonly eventId: EventId;
  readonly expectedRevision: number;
  readonly hostEpoch: number;
  readonly issuedAtEpochMs: number;
  readonly actor: 'host';
  readonly payload: HostCommand;
}
export interface EnginePort<State, Command> {
  readonly type: GameType;
  readonly rulesVersion: string;
  createInitialState(): State;
  transition(state: Readonly<State>, command: Command): State;
  deriveRawScores(state: Readonly<State>): Readonly<Record<TeamId, number>>;
  assertInvariants(state: Readonly<State>): void;
}
