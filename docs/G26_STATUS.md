# G26 — Owner-Gated V2.0 Cutover & Controlled Rollback Preparation

## Parent qualification & protected ancestry
Stacked on G25 draft PR #23 exact qualified head `0a1e54320554ad63db7ca8073fd22bb0a201f3f1`, backed by Verify #38092176249 (220/220 Vitest, 34 suites, typecheck/lint/build) and G4 browser/offline #38092176309 (85/85 Chromium, 7/7 installed offline). Complete logs rechecked and original two build artifacts #11684706999/#11684337545 plus nine visual archives #11685020017/#11683819837/#11684855373/#11684212956/#11684742032/#11684088594/#11684662267/#11684682232/#11684188040 freshly downloaded: 11/11 SHA256 match GitHub upload logs, 11/11 ZIP CRC clean, 7/7 G25 production files SHA256 equal original manifest. Fifteen archived G15 screenshot PNG hashes byte-identical to G24 originals. PRs G12–G25 stay open/unmerged; main still original v1.14. No physical evidence supplied.

## Actual cutover contracts confirmed from source
- Original repo production: `main` still legacy v1.14 (monolithic `index.html`). No production environment was inspected or modified, so domain, active SW cache, live origin cookies/local data, DNS and staging cannot be certified.
- `vite.config.ts`: `base:'./'`; v2 service worker is origin+path scoped. It never automatically calls `skipWaiting` on install; update is direct user-approved after active session checks.
- G2 event store `ligoquiz.v2.sessions` authoritative, independent from legacy `ligo.quiz.*` localStorage. Original G11 `decodeBackup` validates source SHA256, checkpoint consistency, revision, outcomes and all ledger references; real `restoreBackup` is a **write** operation, explicitly NOT called by G26.
- The G25 qualified build evidence `g12-build.json` has exact parent SHA `0a1e54320554ad63db7ca8073fd22bb0a201f3f1`, bundle digest `00d06decc4bf813dfc5ef7af0a7830286b0b5465f45f1a6009a9f66983dedcf9`, relative scope `./`, seven original relative file hashes. Build metadata alone does NOT prove the actual file bytes of a different input distribution; G26 labels metadata-only.

## Concrete G26 operator features
One **V2.0 sicher vorbereiten** read-only preflight in `#/technik`, above the G25 source debrief:
1. Optional exact G25 build manifest import, hash + strict schema, unchanged qualified source head and bundle digest, seven unique safe relative output files, offline precache containment and matching service-worker contract. No upload, install or distribution replacement.
2. Optional **original G25 NO_GO handoff** import, strict closed approval booleans, checked metadata consistency, 105 original rehearsal statuses / G23 issue severity totals and qualified G24/G23 source anchors. Any claimed GO/rights/owner approval rejected.
3. Optional **original G11 full session backup** preview. Invoke original `decodeBackup` in memory, hash source bytes, show game/team count/revision and safe recovery plan (**paused** for unfinished games); never call `EventRepository.restoreBackup`, create any database, write cookie/storage, or export original event ID/team names/private answers. No session restore, automatic migration, host takeover or stage publication.
4. Download a grounded non-executable rollback preparation text and a **NO_GO** data-minimizing machine JSON packet with source digests and absence of human/owner release acceptance; no original file bytes, private roster, private answers, event IDs, keys or signed receipts.
5. Immediate local-only **discard preview** control for each loaded file; no global browser storage clearing. Actionable links to real backup export, operator rehearsal and editorial triage remain, but no **Deploy**, **Approve**, **Restore**, **Merge**, **Migrate** or **Roll back production** command.

## Engineering qualification protocol
- Dedicated Vitest adversarial source/duplicate/path traversal/tamper checks, genuine isolated fake-indexedDB G11 round-trip and unchanged original session, privacy of export and mandatory release NO_GO.
- Dedicated Chromium real G25 UI handoff file → G26 reimport, forged manifest and backup rejection, preserved legacy localStorage and unrelated sessionStorage, rollback text download, 200% zoom & keyboard screenshots.
- Exact-head npm verify/typecheck/lint/build, full Chromium and installed PWA offline 7 regressions; download each original G26 two build/evidence ZIPs and ten visual ZIPs, verify SHA256 against complete logs and ZIP CRC, and all seven bundle digests/locked G15 screenshots.

## Remaining owner gates (NO_GO)
No real hardware/venue or 15 actual physical 3/4/5 team rehearsals, no verified Android/iOS/TalkBack/VoiceOver acceptance, no independent original source rights or approved 704 original questions, no independent G10/legacy origin backup review, no authorized isolated disposable original G11 restore, no environment-specific original production hosting/deployment/rollback acceptance and no owner written permission to merge/migrate/stage/deploy/release or change DNS. The only stage/preflight is an inactive on-page read-only diagnostic; no production or preview deployment.

## Next proposed G27 — Actual Pilot Defect & Owner Acceptance Closure (NOT STARTED)
Ground genuine owner/operator evidence where provided. If absent, focus on concrete UI usability and independently established defects, not another abstract governance ceremony. Preserve original backups, unmerged draft stack and NO_GO; no staging or live cutover without specific authorization.
