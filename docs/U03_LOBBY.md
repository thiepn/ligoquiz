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
