import type { GameType } from '../domain/game/contracts';

export interface GameManifest {
  readonly id: GameType;
  readonly nameDe: string;
  readonly taglineDe: string;
  readonly code: string;
  readonly ready: boolean;
}
export const GAME_MANIFESTS: readonly GameManifest[] = [
  { id: 'rundenquiz', nameDe: 'Rundenquiz', taglineDe: 'Ein Abend, mehrere Runden', code: 'RQ', ready: true },
  { id: 'quiztafel', nameDe: 'Quiztafel', taglineDe: 'Kategorien wählen, Wissen zeigen', code: 'QT', ready: true },
  { id: 'verbindungen', nameDe: 'Verbindungen', taglineDe: 'Hinweise und Zusammenhänge', code: 'VB', ready: true },
  { id: 'logikleiter', nameDe: 'Logikleiter', taglineDe: 'Gemeinsam weiterdenken', code: 'LL', ready: true },
  { id: 'umfrageduell', nameDe: 'Umfrageduell', taglineDe: 'Was würden andere antworten?', code: 'UD', ready: false },
];
export function gameManifest(id: GameType): GameManifest {
  const manifest = GAME_MANIFESTS.find((item) => item.id === id);
  if (!manifest) throw new Error('Unknown game: ' + id);
  return manifest;
}
