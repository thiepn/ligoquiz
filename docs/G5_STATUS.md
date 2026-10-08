# G5 — Shared Product Experience

Working branch: `feature/g5-shared-experience`, targeting `rebuild/v2`.
Production `main` is unchanged. This is not an externally released app.

## Delivered

### Organizer navigation
- `#/spielen` organizer page with explicit start, demo, last committed session and saved setup draft.
- `#/inhalte` truthful placeholder; question import/editors are G10, not fabricated.
- `#/verlauf` completed session directory, `#/bericht?event=...` result-only immutable report view.
- `#/setup` three-step Teams → Programm → Bereit flow.
- `#/host` isolated private Spielleitung without organizer sidebar.
- `#/demo` genuine in-memory single-question host+public-preview rehearsal.
- `#/technik` existing G3 technical rehearsal, and `#/einstellungen` real preference controls.
- `#/stage?event=...` remains audience-only and cannot access private event state.

### Safe setup and return
- Four teams by default (3–5), immediate valid default names, program fixed to currently available Rundenquiz.
- Kurz, Standard, Lang profiles preserved. Additional four modes remain visibly unavailable until G6–G9.
- Draft setup saved in versioned `ligoquiz.v2.setup-draft.v1` localStorage and restored after reload.
- Preparation creates the actual G2 event only at final confirmation; does not auto-publish a question.
- Ready stage explicitly warns about mirrored displays and makes operator acknowledge Beamer or deliberate Beamer-free moderation.
- Organizer lists all valid local sessions, separates incomplete/draft from completed and reports damaged records rather than resetting them.
- Explicit takeover requires a browser confirmation and uses G2's transactional new host epoch, fencing old host commands.
- RundenquizHost loads its G2 session on host entry and conservatively pauses interrupted play.
- No event automatically resumes, reveals a hidden answer, or opens a question.

### Demo isolation
- In-memory `Session` uses real Rundenquiz transition reducer with a one-question slice.
- Private referee answer and public-safe mini stage are rendered in separate panels.
- Operator controls question publication, answer closing, reveal, judging, points and final standings.
- No IndexedDB, stored drafts, saved settings, session host identity, scores in real history, or BroadcastChannel use.

### History and settings
- Completed Rundenquiz event report includes teams, exact integer-half evening points, score awards, count and program metadata.
- Report JSON download deliberately excludes all content bank, private answers and moderator notes.
- Session directory and report use read-only validated IndexedDB queries.
- Preferences: default teams/profile for *new* setups; real reduced-motion override. No fake audio/fullscreen toggles.
- Original v1.14 browser localStorage stays untouched.

## Tests
- `tests/g5-experience.test.ts`: preference/draft validation, event-route parsing, read-only session indexing and corrupt-record count, host takeover fencing, result-only report privacy/ties.
- `e2e/g5-organizer.spec.mjs`: Chromium guided setup/reload, host handoff, disposable demo isolation, preference application.
- Existing G4 real-browser projector/host tests adapted to the isolated `#/host` route.
- CI must pass strict TS, lint, unit tests, Vite build and separate Chromium workflows before merge.

## Known limitations / deliberate deferrals
- Custom programs with 1–5 mixed game types cannot be offered until G6–G9 implement the remaining formats.
- Legacy corpus review, pack/editor/import flow remain G10.
- Offline service worker, full restore/export/backups, damage recovery wizard and physical projector qualification remain G11–G12.
- Existing Rundenquiz host UI still has minor operator visual/interaction debt; real novice-host rehearsal needed before any public release.
- Versioned local preferences are not cloud-synced and cannot bypass browser storage restrictions.
- One same-origin browser context may voluntarily take over host control after explicit confirmation; this is not remote authentication.
- Do not merge into production `main` or alter GitHub Pages/DNS.

## Next
G6 — Quiztafel as the next game engine and unique tile/steal/projector UI.
