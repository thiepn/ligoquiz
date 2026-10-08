# G4 — First Playable Rundenquiz

Work branch: feature/g4-rundenquiz; target rebuild/v2. No production deployment.

## Implemented

- Pure BP-03 Rundenquiz engine: Wissen, Hinweise, Schätzen, Finale.
- 3–5 teams; Kurz 7 questions, Standard 11, Lang 16.
- Verbal/paper answer adjudication, clue locks, stage-controlled publication, exact BigInt decimal and metric estimation, competition-ranking ties, and correction/annulment.
- Host React setup, live control workbench, scoring preview, explicit confirmation and standings.
- One authoritative G2 event snapshot per event, validated by Zod. RQ actions are G2 commands with idempotent receipts, revision and host epoch fencing.
- All team awards for a question, audit entry, committed session, command receipt and checkpoint are written within one IndexedDB transaction. Corrections void old ledger records and add new revisioned awards.
- Explicit host takeover and safe recovery update RQ owner and epoch within G2; no automatic host takeover.
- G3 stage receives allowlisted public DTOs only: visible question/clues, deliberately revealed answer, or committed scoreboard. No unpublished solution, private estimate or moderator notes.
- Timer stored as host/epoch/task-scoped advisory snapshot in v2 IndexedDB timers store; v1 schema upgraded in place. Recovery preserves the last saved remaining time stopped, with no automatic reveal/advance.
- The existing G3 tech check is preserved separately.

## Tests and exit gates

- Test matrix covers 3–5 team profiles, ties, decimal conversion, stage privacy, score retries/correction, host takeover, timer authority fencing and v1-to-v2 upgrade.
- Strict TypeScript, lint, unit tests and Vite build must all pass GitHub Actions on the final branch commit.
- Real-world two-display rehearsal, Playwright browser journey, keyboard accessibility, and first-time host usability are still release gates; CI alone does not certify them.
- The 16-question trial bank is provisional and NOT the audited v1.14 content library. Content/editorial sign-off is pending.
- No production merge to main, GitHub Pages change, DNS change, v1.14 data migration or service-worker update.

## Moderator rehearsal

1. Run npm ci and npm run dev locally at a separate origin.
2. Open Spielen → Rundenquiz, configure profile and 3–5 teams.
3. Open Beamer in a second browser window on an extended display.
4. Play every round, test clue locks, estimates and unit confirmation, private judging, score preview and explicit reveal.
5. Correct or annul a scored question; verify visible scores and auditable G2 ledger.
6. Reload during an open question: host and advisory timer must remain paused until explicitly resumed.
7. Close the host: projector should blank after heartbeat expiry.
8. Perform a real quiz rehearsal and editorially approve actual questions before public use.

## Next

Complete browser and physical-projector qualification, then proceed to next games without confusing engineering completion with production release.
