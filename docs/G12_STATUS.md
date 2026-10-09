# G12 — 3/4/5-Team Rehearsal, Failure Recovery & Release Evidence

**Status:** stacked draft for verification; no human signoff implied. Base: G11 `feature/g11-production-resilience`, PR #9, at `b4ad4ad5f6b17436b95893cdb295e7f0b052f620`. Production `main` remains the legacy v1.14 release. No deploy/merge/DNS/storage deletion authorized.

## Mandatory automated dress-rehearsal matrix

The real Chromium host/projector suite `e2e/g12-rehearsal.spec.mjs` runs **all 15** combinations of five game engines × three, four, five teams; it refuses a false success if any assertion fails.

| Game | 3 teams | 4 teams | 5 teams | Scoring path exercised |
|---|---|---|---|---|
| Rundenquiz | CI required | CI required | CI required | answer closure, private reveal, independent team judgments, commit |
| Quiztafel | CI required | CI required | CI required | category board, selector win, reveal, immutable commitment |
| Verbindungen | CI required | CI required | CI required | progressively hidden clue, shared public reveal, score commitment |
| Logikleiter | CI required | CI required | CI required | locked answer, explicit solution, graded team decisions |
| Umfrageduell | CI required | CI required | CI required | illustrative-source prompt, canonical answer mapping, team score commitment |

Each case creates distinct team identities; opens a **separate public projector browser tab**; checks that the correct answer is not visible before reveal; reloads host *mid-question*; demands projector blackout and explicit host resume; commits the first score and checks **all N scoreboard positions**; exports a genuine browser-downloadable backup with event, audit, outcome and checkpoint records; verifies the checksum, game ID, roster and revision. A separate test validates that reimport of the same event ID is rejected without duplicating the original.

The built-PWA suite `offline-e2e/g12-rehearsal-offline.spec.mjs` uses a **Vite production build**, activates a real origin-scoped service worker, opens a game and then disconnects the browser context. It cold-reloads host state and navigates a **new stage window** offline for each of the five game engines, testing 3/4/5-team samples, then accesses the local backup controls. These are automated *selected-phase* recovery rehearsals, **not** an assertion that all five full-length games were played physically.

Both suites are added to the **existing mandatory** G4 browser workflow: no `test.skip`, no increased retry count, no weaker screenshot standards, no automatic unreviewed content approval, no change to public-only projection schema.

## Physical acceptance ledger (human review required)

The owner/organizer must record an independently observed rehearsal **for all 15 cells**. Record for each: date, reviewer, machine/browser OS and version, display resolution, 3/4/5 actual team count, stage monitor arrangement, game profile and question-pack source, observed stage privacy before reveal, scoring and correction, midpoint close/restart, return-to-game state, signed acceptance or reasoned failure and trace/screenshot reference. No default approval, inferred signature or automatic publication.

Separately certify: actual 1280×720 extended-display legibility from the back of the room; Android/iOS install and offline cold boot where supported; keyboard-only moderation and accessible focus announcements; 200% text and reduced motion; AV cable removal/reconnection; storage quota pressure; offline power-cycle; and two-window host fencing. Projector mirroring may expose host-only answers and must be specifically ruled out.

## Content, privacy and rollback invariants

- G10 review decisions and full corpus/source provenance remain **independently pending**. Draft/trial content is explicitly not live-approved. The G9 illustrative survey is not real polling data.
- Public stage receives only public stage frames. Never upload private question answers, complete backups, user profiles, or screenshots of unrevealed host content as public CI artifacts. CI filenames/reporters must not reveal answer payloads.
- No live Supabase/API/cloud integration is assumed. Local IndexedDB is authoritative and the built shell provides **no cross-device score synchronization**.
- Three separate backup assets may be necessary: G11 per-session full recovery file, G10 editorial library export, G10 legacy `ligo.quiz.` browser-origin backup. Never overwrite originals or silently migrate active legacy sessions.
- A test failure remains a release blocker. Re-run checks on the **exact final commit SHA**. G11 branch must remain untouched while G12 is qualified.
- Before G13 reversible cutover: archive verified v1 source and source-origin data, validate isolated HTTPS preview at correct path/scope, record recoverable dist artifact/hash and Git SHA, test rollback to legacy without changing browser-origin data; secure **explicit written approval** for merge, deployment and production DNS switch.

## Evidence record (fill only after genuine execution)

| Gate | Machine evidence | Human evidence | Status |
|---|---|---|---|
| G11 parent exact-head | Verify and Chromium green at b4ad4ad5 | Physical device acceptance | Automated green; human pending |
| G12 verify/build | Run ID, SHA, full job logs and artifact checksum | N/A | Pending G12 CI |
| G12 15 host/stage cases | Full Playwright report and SHA | 15 separate observed rehearsals | Pending |
| G12 five offline cold-start cases | Built-PWA Playwright run/diagnostics | Real offline restarts across required devices | Pending |
| G10 editorial/source review | G10 validation/attestation records | Source-licensed factual approval | Pending |
| G13 release authorization | Versioned artifact+rollback replay | Named owner release signoff | **Not authorized** |

**G13 next:** Controlled Cutover, Verified Deployment & Reversible Rollback. Do not start merging or production publication as a side effect of this draft.
