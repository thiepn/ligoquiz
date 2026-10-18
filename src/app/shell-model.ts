import type {Route} from './routes';

export type ShellZone = 'spielwelt' | 'spielleitung' | 'backstage' | 'public';
export type ShellLink = {route:Route; label:string; description:string; symbol:string};

export const PRIMARY_LINKS:readonly ShellLink[] = [
  {route:'spielen',label:'Spielwelt',description:'Spiele & Abende',symbol:'✳'},
  {route:'host',label:'Spielleitung',description:'Live moderieren',symbol:'●'},
  {route:'inhalte',label:'Backstage',description:'Inhalte & Werkzeuge',symbol:'✦'},
];

export const BACKSTAGE_LINKS:readonly ShellLink[] = [
  {route:'inhalte',label:'Inhaltsatelier',description:'Fragen & Quellen',symbol:'▦'},
  {route:'verlauf',label:'Vergangene Abende',description:'Berichte & Ergebnisse',symbol:'◷'},
  {route:'technik',label:'Beamer & Technik',description:'Sichere Vorbereitung',symbol:'▣'},
  {route:'einstellungen',label:'Einstellungen',description:'Gerät & Sicherungen',symbol:'⚙'},
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

export function shellHeadingFor(route:Route):{overline:string;headline:string;description:string}{
  const zone=shellZoneFor(route);
  if(zone==='spielleitung')return {overline:'LIVE-KONTROLLE',headline:'Spielleitung',description:'Alles im Blick. Nur freigegebene Inhalte auf dem Beamer.'};
  if(zone==='backstage')return {overline:'HINTER DEN KULISSEN',headline:'Backstage',description:'Inhalte, Ergebnisse und Technik — getrennt vom Spiel.'};
  if(route==='setup')return {overline:'VOR DER SHOW',headline:'Spielabend vorbereiten',description:'Teams und Programm einstellen. Noch nichts wird veröffentlicht.'};
  return {overline:'DIE SHOW BEGINNT HIER',headline:'Spielwelt',description:'Deine Spiele, dein Abend, deine Bühne.'};
}

export function shellShortcutsFor(route:Route):readonly ShellLink[]{
  if(route==='host')return [PRIMARY_LINKS[0]!,BACKSTAGE_LINKS[2]!];
  if(route==='setup')return [PRIMARY_LINKS[0]!,BACKSTAGE_LINKS[2]!];
  if(route==='spielen')return [
    {route:'setup',label:'Neuen Quizabend',description:'Teams & Programm',symbol:'↗'},
    {route:'demo',label:'Demo öffnen',description:'Ohne Spielstand',symbol:'▷'},
  ];
  if(route==='technik')return [PRIMARY_LINKS[1]!,PRIMARY_LINKS[0]!];
  if(route==='verlauf'||route==='bericht')return [PRIMARY_LINKS[0]!,BACKSTAGE_LINKS[0]!];
  if(route==='einstellungen')return [PRIMARY_LINKS[0]!,BACKSTAGE_LINKS[2]!];
  return [PRIMARY_LINKS[0]!,{route:'setup',label:'Neuen Quizabend',description:'Teams & Programm',symbol:'↗'}];
}
