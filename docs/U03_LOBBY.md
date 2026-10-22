# U03 — Studio Pop game-show lobby

This phase replaces **only** the real `#/spielen` home in `OrganizerHome`, keeping U01 tokens and U02 shell.

## User-facing changes
- Poster-scale dark/cobalt **Heute wird gespielt!** hero with explicit new-evening and disposable-demo calls to action.
- Five reusable `GameTile` choices linked through an **explicit button action** to the original `#/setup` wizard. Selection writes only the original `ligoquiz.v2.setup-draft.v1` structure with `saveSetupDraft`, preserving count, teams, profile and source; changes to progressed saved drafts require confirmation. No live event or public scene is written.
- Real-session continuity: original `EventRepository.listSessions`, `filterSessions`, `ResumeButton` takeover with revision/epoch CAS and host ownership are retained, including errors, damaged-record warning and explicit consent.
- Real local setup-draft banner; no fictitious scores, player ranks, session health or availability.
- Searchable session cards, loading and empty states and shortcuts to the existing actual backstage routes.
- Responsive 5→3→2→1 grid, large targets, focus indicators and reduced-motion styles.

## Boundaries
No alterations to session engines, `HostSurface`, `StageView`, `SetupWizard`, offline worker, editor permissions, source provenance, reports, recovery, release preflight or G26 NO_GO. The U03 selection moves to the existing wizard where content authority is checked; it does **not** start or publish a game. Probe datasets remain explicitly described as unapproved sample content.

## Development checks
Run exact-head TypeScript, ESLint and Vite plus lightweight tests / Chromium lobby checks. Full projector/physical venue acceptance is deferred until after U10.

## U03 browser compatibility follow-up

The original G4 browser run #39159532507 had three failed checks that referenced retired presentation selectors/copy, not demonstrated lost game behavior:

- G13 session count `2 von 2 Spielständen` was renamed to a live `2 von 2` counter.
- G13/G5 `.exp-active` and `.exp-session-row` cards were replaced by `.sp-lobby-featured` and `.sp-lobby-session-row`.
- G5 `Demo ausprobieren` became the genuine `Demo ansehen` link in the U03 hero.

Original G13 two-session creation, filter/clear/no-result assertions and original G5 setup reload, host takeover, complete disposable demo sequence, private answer reveal protection, zero IndexedDB sessions, and preferences assertions remain. Only UI-target references were updated; production host, projector, persistence and game code is untouched. Comprehensive qualification remains after U10.

- Follow-up G4 run #39160737698: **94/94 regular Chromium tests pass**, including G5 and G13. Offline G11 shell assertion still expected retired homepage heading `Quizabend organisieren` after navigating to `#/spielen` with the browser offline. Update only that heading to the real U03 headline `Heute wird gespielt!`; preserve the prerequisite service-worker activation/controller, explicit preflight, offline navigation to both Spielwelt and Technik, and original other six offline tests.
