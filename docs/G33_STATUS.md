# G33 — Recoverable source-only five-game preparation drafts

## Verified predecessor
G32 exact-head SHA 3f396be8e227f63d2117536804d0d1edbf57785a:
- Verify #40312827451 PASS: 387/387 Vitest, TypeScript, ESLint, build, scoped PWA.
- Browser #40312827920 PASS: 223/223 Chromium and 7/7 installed-offline PWA tests.
- G10 and G26 release authority remains NO_GO.

## Implementation
- Separate same-origin IndexedDB \`ligoquiz.v2.preparation.g33\`, versioned \`drafts\` store. A single current local evening draft saves exact selected slot IDs, profile, 3/4/5 team configuration, chosen game and moderator phase position.
- The only source evidence persisted is original ID, game, revision and SHA-256 of the exact original payload/status/provenance bytes. No question text, answers, clues, reviewer identity, surveys, private host events or approval authority is copied.
- Read/write/discard use actual readwrite IndexedDB transactions and revision-based optimistic conflict checks; a second stale browser tab cannot overwrite or delete another tab’s newer saved plan.
- Auto-restores a saved plan and moderator position only when every selected source and assignment is unchanged; marks changed/missing/invalid source evidence STALE and refuses silent load/save. Reviewer can inspect changed source in original G10 and explicitly discard this separate local draft. Draft changes to original questions remain protected by the existing independent G10 CAS and four-check approval.
- When saving, rereads the actual current G10 IndexedDB source library and cross-checks revision and SHA-256 before persisting. Changes arising after source read are rechecked on next load; this is not a cross-database transaction.
- Native controls show local revision, unsaved changes, stale-source issues, manual save and explicit discard. Stage public DTO and all five original host grading/cutover/recovery engines unchanged.

## Qualification
Positive/adversarial fake-IndexedDB tests for durable reopen, 45 game/profile/team selections, actual CAS races, exact hashes, altered payload without revision increment, stale status/removal, unrelated-source change, malformed and duplicate records, clear conflict; real Chromium native save/reload/stale revision tests and actual installed-offline PWA reload.

No publication, live writes, merge, migration, rights attestation, human reviews or G26 release authorization.
