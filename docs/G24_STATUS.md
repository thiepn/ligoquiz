# G24 — Real Game-Night Pilot Operator Workflow & UX Hardening

## Parent qualification
Stacked from G23 PR #21 exact qualified SHA `d88e8c0289b36d1af7e0253b7f7c0c6a372df183`. Verify run `38075890163` (206/206 Vitest, 32 files, TS, lint, production build), full Chromium `38075890178` (79/79) and installed offline `7/7`, exact-head G23 original nine artifacts (two production build ZIPs and seven visual ZIPs) downloaded, SHA-256 and ZIP CRC independently verified and seven hashed bundle files checked against exact-head manifest. G12–G23 ancestor drafts remain separate, open and unmerged. G24 draft is nondeploying only.

## Observed source-level operator failure addressed
G18 `EventTrialReadiness` held the coordinator's 15×7 physical rehearsal observations in **ephemeral React state only**. A reload discarded unexported session notes and manually recorded defects. G24 adds an explicit, limited **same-tab** `sessionStorage` recovery snapshot using G18 canonical SHA-256 envelope validation, 256 KiB hard size limit and 30-day stale-rejection. Nothing automatically overwrites the current G18 state; on reload the owner must explicitly choose **Lokalen Entwurf wiederherstellen**. Corrupt/tampered/oversized drafts are rejected without deletion, protected `ligo.quiz.*` and G10/G11 event and content stores are not accessed. The operator can delete only the single new G24 session key without touching the currently open checklist or source backups.

A monotonic generation guard prevents stale async hashing operations writing older UI snapshots over new ones or after the operator clears the draft. Browser storage is only a tab-local convenience, never an authoritative backup, signature, original evidence, independent operator identity or production session state. G18 export/import remains the durable and original-preserving workflow.

## Visible operator features
- Filter exactly 15 G18 scenarios by all five games, 3/4/5 teams and not-yet-complete / problem / self-reported statuses.
- Status tiles distinguish not started, partially self-reported, reported defect, and seven self-reported observations, NEVER genuine external acceptance.
- One-click **Nächsten offenen Fall öffnen** cycles through uncompleted or defect-marked cases without pre-filling a status or bypassing human work.
- Game-specific host cue cards for opening, scoring and crash/recovery: Rundenquiz hidden-answer scoring; Quiztafel selection/steal; Verbindungen clues/sequence/wall; Logikleiter rung revisions and score fencing; Umfrageduell illustrative responses/round sums.
- Download a privacy-conscious per-scenario text run card showing the actual host, setup, projector/offline and backup path plus the seven statuses. It is explicitly a planning aid, not physical test proof, includes no copyrighted question texts, private answers or file bytes.
- Mobile-responsive keyboard-focusable operator controls with reduced reliance on deep 15-row scanning.

## Qualification
- Adversarial TS/Vitest tests for all 15 statuses, source-bound G18 checksums, tampering, empty/too-large/stale drafts, local key isolation, recovery and five specific host cues.
- Chromium tests with actual page reload, G24 sessionStorage restoring *only after button approval*, isolated G24-only deletion preserving other storage, per-game filters, run card file content, real form controls and 200% zoom screenshot evidence; full browser regression and offline scoped PWA required on the exact final head.
- Do not alter G15 locked original goldens, original game engines, scoring, protected screenshot references, any legacy/main content, owner/release authority, DNS, deployed origin, production database, original backups or human judgments.

## Original real-world pilot blockers
No actual physical venue projector, 15 real game-night performances, original operator identification, independent human/accessibility-device testing, original-rights licensed question corpus, approved disposable restoration or owner release signoff was performed. G24 self-recorded statuses remain **NO_GO** for merge/deployment and public release.

## Next proposed G25 (NOT STARTED)
**Real-World Pilot Evidence Reconciliation & V2.0 Release Candidate**. Evaluate genuine original hardware/venue and operator feedback (if independently supplied), fix *observed* in-game defects with adversarial evidence, reconcile source rights and owner rollback prerequisites, then test integrated draft stack for release-candidate readiness. No automatic merge or deployment.
