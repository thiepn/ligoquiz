export type Route = 'spielen' | 'inhalte' | 'verlauf' | 'stage';
const ROUTES: readonly Route[] = ['spielen', 'inhalte', 'verlauf', 'stage'];
export function parseRoute(hash: string): Route {
  const key = hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
  return ROUTES.find((route) => route === key) ?? 'spielen';
}
export function routeHref(route: Route): string {
  return '#/' + route;
}
