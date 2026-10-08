# G1 — Engineering foundation acceptance report

## Repository
- Branch: rebuild/v2, separate from production.
- Legacy production commit: f70e73f3c5b740ad3baf9580431f8393246b4eb0.
- Production main, GitHub Pages, DNS, and legacy browser data left unchanged.
- React 19, strict TypeScript, Vite; separate domain, game registry, UI, and tests.
- Dependency lockfile generated from successful GitHub CI; all future jobs use npm ci.
- Workflow privileges tightened to read-only after initial lockfile creation.

## Implemented
- Navigable German app shell: Spielen, Inhalte, Verlauf.
- Separate audience-only stage waiting preview (not synced yet).
- All five game types registered but explicitly not playable.
- Exact BP-03 rank/tie allocation in integer half-points.
- Stage publication allowlist, protected by unrevealed-answer leakage tests.
- Three Vitest suites: 8 tests, including exhaustive score allocations for three, four, and five teams.
- ESLint, strict tsc, Vite production compile, GitHub Actions checks.

## Verified initial CI
- GitHub Actions run 37821736171 on commit 7f554e24d26b89db42fa20282e3ff611e2604d11: success.
- 3 test files passed, 8 tests passed; TypeScript, lint and production build passed.
- Package-lock created in commit 5023c796d2cd6d3ba574427e3eaafeabb87109e4.
- Final read-only CI run on this hardening commit remains to be verified.

## Deliberate exclusions
- No working games, event session persistence, automatic scoring or saved history.
- No host/projector BroadcastChannel connection yet (G3).
- No complete content library or legacy import (G10).
- No offline service worker or production deployment (G11–G13).
- No owner sign-off on provisional rules and visuals.

## G2 contract
Implement transactional host command bus, IndexedDB versioning, revisions,
idempotency, host fencing, crash-safe checkpointing and deterministic tests.
Do not merge unfinished v2 changes to main.
