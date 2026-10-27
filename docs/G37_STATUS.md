# G37 — Source-bound rehearsal checkpoints and team-turn moderator operations

Starting head G36 045da9cca524ca8790c17eb6614b8e233f98043a:
Verify #40399458497 PASS 414/414 Vitest, TS, ESLint, build.
Chromium/offline #40399458485 PASS 228/228 Chromium and 11/11 installed-offline PWA.

Native moderator G36 five-game cue desk gains:
- actual original team-specific cue navigation with an explicit 3–5 team selector; shared quizzes are not mislabelled exclusive to a team
- per-question rehearsal markers with deliberate toggle and per-game counts, distinguishing dry-run work from G10 editorial review, scoring, publication or real play
- skip to next not-yet-rehearsed source-bound original question across all five engines
- source-ID+revision-bound markers saved only through manual G33 local IndexedDB CAS; rollback, source reassignment and G34 surgical recovery selectively discard affected markers, preserve unrelated valid markers, never grant rights
- source-only public phase preview, not live projector interaction, no question text/answers/rights claims in the new marker storage

Preserve original 79 trial IDs; 704 V1 historical metadata independent; all original G10–G36 authoring, five game engines, CAS, four human approval checks, backup and public-only stage DTO. No new approval/publishing/migration/deployment. G26 NO_GO.

Executable positive/adversarial unit: 45 combinations, team routing, deduped marks per slot, fabricated source and duplicate marker refusal, source-revision invalidation, independent CAS, selective recovery. Real Chromium and installed-offline PWA: mark/save/reload/unmark, team navigation and phase-only projector preview. No release claim.
