# LiGoQuiz 2.0 — G1 Engineering Foundation

**Working branch:** rebuild/v2. **Production:** main (legacy v1.14), unchanged.

G1 is a **non-playable foundation**, not a v2.0 release:
- React 19 + TypeScript strict + Vite static shell with German navigation.
- Typed domain contracts, five game manifests (all marked not ready).
- Pure BP-03 rank/tie scoring with exact integer half-points.
- Explicit audience data allowlist and regression tests against answer leakage.
- CI with TypeScript checks, linting, unit tests and a static bundle build.
- No accounts, backend, PWA registration, legacy migration or published preview.

## Local setup

Node.js 22.12+ and npm 11 required.

    npm ci
    npm run dev
    npm run verify
    npm run build

The committed package-lock.json is the dependency source of truth.

## Routes

- #/spielen — preview of game selection.
- #/inhalte — empty future content studio.
- #/verlauf — empty future event history.
- #/stage — public waiting screen (not synchronized).

No live gameplay or saved sessions exist on this branch yet.

## Safety

Do not deploy to production GitHub Pages from this branch. G1 does not read or
write any legacy localStorage keys. Use a distinct origin, not merely a path,
if hosting a future preview to avoid shared browser storage and service-worker
scope with the legacy application.

Next: G2 state engine and crash-safe persistence; G3 projector protocol;
G4–G9 games; G10 migration; G11 PWA and qualification.
