# G1 — Engineering foundation acceptance report

- Target: rebuild/v2. Production main pinned at f70e73f3c5b740ad3baf9580431f8393246b4eb0.
- Scope: TypeScript/React/Vite, domain contracts, typed game inventory, stage privacy, scoring, CI.
- Implemented: modular TypeScript, non-playable German shell, projector waiting preview.
- Tests: exact half-point ranking over all 3–5 team ternary cases; stage unpublished-answer minimization; route and game registry.
- Not implemented: session persistence, playable games, host/projector sync, content migration, offline PWA, real deployed preview or E2E.
- Release constraint: never change main, Pages, DNS, service worker scope or legacy storage during G1.
- G1 complete only when final branch SHA passes GitHub CI, the lockfile is committed, and main remains unchanged.
