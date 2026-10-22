import type {GameType} from '../domain/game/contracts';

/**
 * U01 Studio Pop: display-only, offline-safe visual vocabulary.
 * These labels and colors do not represent game state or scoring authority.
 */
export type TeamTone = 'blue' | 'pink' | 'mint' | 'orange' | 'violet';
export type GameVisual = {
  label: string;
  kicker: string;
  description: string;
  category: string;
  symbol: string;
  tone: TeamTone;
};

export const GAME_ORDER: readonly GameType[] = [
  'rundenquiz', 'quiztafel', 'verbindungen', 'logikleiter', 'umfrageduell',
];

export const GAME_VISUALS: Readonly<Record<GameType, GameVisual>> = {
  rundenquiz: {
    label:'Rundenquiz', kicker:'WISSEN IM RAMPENLICHT',
    description:'Große Fragen. Starke Antworten.', category:'01 / QUIZ', symbol:'?', tone:'blue',
  },
  quiztafel: {
    label:'Quiztafel', kicker:'KATEGORIE WÄHLEN',
    description:'Kategorien, Punkte, Spannung.', category:'02 / BOARD', symbol:'★', tone:'violet',
  },
  verbindungen: {
    label:'Verbindungen', kicker:'FINDE DAS MUSTER',
    description:'Vier Hinweise. Eine Verbindung.', category:'03 / PUZZLE', symbol:'✳', tone:'pink',
  },
  logikleiter: {
    label:'Logikleiter', kicker:'STUFE FÜR STUFE',
    description:'Je höher, desto kniffliger.', category:'04 / LOGIK', symbol:'↑', tone:'mint',
  },
  umfrageduell: {
    label:'Umfrageduell', kicker:'WAS DENKEN DIE ANDEREN?',
    description:'Trefft die beliebtesten Antworten.', category:'05 / DUELL', symbol:'≡', tone:'orange',
  },
};
