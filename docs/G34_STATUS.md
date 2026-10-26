# G34 — Selective source-by-source local plan recovery

## Starting point
G33 final HEAD c485fff797b67add0d674c94f7dc5c0c31e1f359:
Verify 40316805196 PASS 395/395 unit;
browser/offline 40316805223 PASS 225/225 Chromium, 8/8 installed offline.

## Implementation
- Retain all original valid assigned source IDs, game/profile/team selection and moderator rehearsal position even when another selected question changes.
- Independently verify every source's original G33 SHA-256 payload/status/rights provenance hash and revision; changed, missing or category-dependent incompatible assignments become explicitly empty slots, not invented replacement questions.
- Propagate Quiztafel category invalidation to its dependent rows; retain unaffected teams/categories.
- Native G10 source-reference review entrypoints list every affected original slot, reason and source ID. Preview neither mutates the source bank nor saves the plan. An explicit affirmative decision rechecks all source fingerprints, source selections and the current G10 library, then atomically creates a new revision in the separate G33 IndexedDB CAS. A stale revision or forged proposal fails closed.
- Original rights/checklist, editorial status, all five engines, events, projector DTO and host authority are unchanged. Recovered partial plans remain NO_GO and explicitly incomplete until a reviewer selects and verifies replacements.
- Real mobile/desktop semantics: source review remains inside G10, keyboard-accessible buttons; no filler captions and no decorative stage microcopy.

## Acceptance
Unit tests: partial question edit, unchanged sibling, Quiztafel category rows, changed status/rights, missing sources, forged/stale proposal, CAS lost race, unrelated additions, and unchanged-library refusal. Genuine Chromium: source save → stale → preview → accepted partial recovery → reload. Installed offline PWA: same sequence without network.
No new rights approval, publication, merge, migration, staging or production writes.

## Original source ordering preservation
New questions can sort ahead of previously selected questions without changing those original source bytes. Explicit recovery pins the original source IDs and can commit a new local CAS revision even when no slots need clearing. It never silently adopts newly sorted defaults, approves content or launches a game.
