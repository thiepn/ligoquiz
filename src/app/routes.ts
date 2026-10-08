export type Route =
  | 'spielen' | 'setup' | 'host' | 'demo' | 'inhalte' | 'verlauf' | 'bericht'
  | 'einstellungen' | 'technik' | 'stage';
const ROUTES: readonly Route[] = [
  'spielen','setup','host','demo','inhalte','verlauf','bericht','einstellungen','technik','stage',
];
export function parseRoute(hash: string): Route {
  const key = hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
  return ROUTES.find(route => route === key) ?? 'spielen';
}
export function routeHref(route: Route): string { return '#/' + route; }
export function currentEventId(hash: string): string | null {
  const raw = new URLSearchParams(hash.split('?')[1] ?? '').get('event');
  return raw && /^[a-zA-Z0-9_-]{8,128}$/.test(raw) ? raw : null;
}
