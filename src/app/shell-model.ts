import type {Route} from './routes';

export type ShellZone = 'spielwelt' | 'spielleitung' | 'backstage' | 'public';
export type ShellLink = {route:Route; label:string; symbol:string};

export const PRIMARY_LINKS:readonly ShellLink[] = [
  {route:'spielen',label:'Spielwelt',symbol:'✳'},
  {route:'host',label:'Spielleitung',symbol:'●'},
  {route:'inhalte',label:'Backstage',symbol:'✦'},
];

export const BACKSTAGE_LINKS:readonly ShellLink[] = [
  {route:'inhalte',label:'Inhaltsatelier',symbol:'▦'},
  {route:'verlauf',label:'Vergangene Abende',symbol:'◷'},
  {route:'technik',label:'Beamer & Technik',symbol:'▣'},
  {route:'einstellungen',label:'Einstellungen',symbol:'⚙'},
];

export function shellZoneFor(route:Route):ShellZone{
  if(route==='stage')return 'public';
  if(route==='host')return 'spielleitung';
  if(route==='spielen'||route==='setup'||route==='demo')return 'spielwelt';
  return 'backstage';
}

export function backstageActiveRoute(route:Route):Route{
  return route==='bericht'?'verlauf':route;
}

