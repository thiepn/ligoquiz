# G8 — Logikleiter vertical slice

Branch `feature/g8-logikleiter`, based on G7 `feature/g7-verbindungen`. Trial only. Never merge directly to `main`.

## Implemented BP-03 candidate mechanics
- 3–5 teams all receive the same shared ladder, no elimination and no branching puzzle trees.
- Kurz 3 rungs (10/20/30), Standard 5 (10–50), Lang 7 (10–70).
- One optional deliberate public hint for each rung. Locked team answer records hint revision 0 (full points) or 1 (half points). A locked attempt cannot be changed.
- Host may explicitly close responses, publish explanation, adjudicate correct/wrong/absent, commit, correct or reasonedly annul.
- A reasoned `FAIR_HINT` command applies full value to correct post-hint answers after accidental hint exposure.
- Timers remain host-only advisory (60 seconds rungs 1–2, 90 seconds 3–5, 120 seconds 6–7). Timer expiry never triggers state changes.
- Exact integer-half normalization for evening ranking with shared ties. No steals, wagers, elimination, negative points or automatic speech/text grading.

## Architecture
- `src/games/logikleiter/engine.ts`: pure typed transition and scoring engine.
- `src/games/logikleiter/schema.ts`: strictly validated persisted session and commands, immutable rung order, roster, locks and awards.
- `src/games/logikleiter/trial-bank.ts`: seven **provisional** logical problems; not certified, independently solved or editorially approved.
- `EventRecord.logikleiter` and `LL_ACTION`: host-epoch fenced, one authoritative database transaction for command receipt, event state, score ledger, audit and checkpoint.
- G3 public allowlisted `ll-ladder` / `ll-answer`: private solutions, grading, lock timestamps/hint revisions and explanations remain absent until deliberate reveal.
- `src/features/host/LogikleiterHost.tsx`: moderator UI for every rung; separate public projector, timer, locks, hint, adjudication, correction, pause/recovery.
- G5 organizer setup, saved session history, final JSON report, game registry; G8-specific studio and projector styling.

## Tests and release gates
- `tests/g8-logikleiter.test.ts`: nine full profile/team simulations, lock/hint proof, fairness handling, private projection, correction, no-answer grading, annulment, atomic ledger with idempotent retry, host takeover, pause.
- `e2e/g8-logikleiter.spec.mjs`: Chromium host+projector privacy/reveal/score correction, paused recovery of pre-hint locks.
- Required checks: `npm run verify`, production build, full Chromium regressions against exact PR head.
- Editorial uniqueness/provenance and difficulty calibration are **unverified**; physical projector/keyboard/mobile/offline usability and content migration remain subsequent gates.

## Dependency order
G4B PR #2 → G5 PR #3 → G6 PR #4 → G7 PR #5 → G8 (this PR). G8 must be retargeted to `rebuild/v2` only after upstream merges.
G9 Umfrageduell follows qualification of G8. No production release or legacy storage overwrite.
