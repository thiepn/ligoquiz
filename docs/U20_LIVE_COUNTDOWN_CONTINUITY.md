# U20 — Four-game live host countdown continuity

## Reproduced source defect and scope

Before U20 the original Quiztafel, Verbindungen, Logikleiter and Umfrageduell hosts duplicated in-memory optional countdown loops. Each reset effect depended on the original \`paused\` Boolean. Pausing an active 20s, 30s, 45s, 60s, 180s or 10s countdown therefore restored the full duration; resuming could silently give a team extra time and compromise the original competition's fairness.

U20 replaces these four duplicated loops with one \`useHostCountdown\` hook, **using the same original timers and button actions**, no new timed action, scheduler, persistence, stage command, or grading authority. Scope is explicitly the original event ID, host epoch, game task ID, original phase, and when appropriate the canonical Verbindungen clue index. **Pause is not part of the scope**, so an official host PAUSE stops the countdown while keeping the actual remaining seconds. Explicit RESUME never automatically starts a countdown; the host must select the original **Start** control. Stopp and Zurücksetzen keep their original meaning.

Changes to an original task/phase reset the optional countdown intentionally. Quiztafel distinguishes the 20-second first answer and 10-second steal windows. Verbindungen distinguishes its clue rounds, 45-second sequences and 180-second walls. Logikleiter uses its original rung duration and Umfrageduell uses the original 30s/60s formats. The countdown stops on a recovery-required event, revoked/unknown host, or canonical owner-epoch transition; unlike pause, an owner-epoch change invalidates the old scope. No hidden tab activity grants extra time; ticks account for actual elapsed seconds. Original mandatory user decisions are never dispatched automatically at zero.

Existing Rundenquiz has its own original validated advisory IDB timer snapshots (\`rundenquiz/timer.ts\`) and **remains untouched**. The U20 four-game timers remain intentionally **volatile across browser reload**, consistent with the original implementation: this is not a claim of cross-reload timer preservation. Scores, original revision/CAS event transactions, backups, source rights, G15 projection DTO, U13–U19, G26 release NO_GO remain unchanged. The timekeeper is private to the original host and never published as an authoritative public stage clock.

## Acceptance

- \`tests/u20-host-countdown.test.ts\`: verified actual source-prepared four-game event identities, pause scope equality and changed owner/task/phase invalidation, original Quiztafel answer/steal and Verbindungen per-clue scopes, full-second elapsed-time rounding and no scoring/projection authority.
- \`e2e/u20-live-countdown.spec.mjs\`: genuine Chromium for all four original game hosts: start, elapsed seconds, PAUSE, exact remaining seconds after RESUME, no implicit restart, intentional subsequent Start/Stop/Reset, Quiztafel 10-second mobile steal and Verbindungen next-clue fresh window.
- Original exact-head Verify and G4 workflows must still qualify all existing assertions and 7 installed offline PWA tests.

Same original open DRAFT PR #25, branch \`design/ligoquiz-3-game-show\`, original base; no merge/rebase, deployment, migration, credentials, production writes, manually dispatched paid CI or costs.
