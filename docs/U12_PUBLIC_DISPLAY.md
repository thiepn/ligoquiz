# U12 — Audience-readable optional projector display

## Observed gap
The original public projector is designed for a baseline viewing setup, but real venues can need larger question text or stronger contrast. The default stage cannot be changed without affecting the 15 locked G15 reference images, and copying private host questions into another renderer would violate the public/private separation.

## Implementation
A deliberate host link **Beamer-Lesemodus öffnen** opens the existing canonical public StageView at `#/stage?event=<original-id>&display=accessible`. The original projector link remains byte-identical and continues to render its default design.

The same original StageViewer and strict public-scene DTO drive the optional mode. On the actual spectator window, **Anzeige** opens the locally controlled accessibility settings:
- Normal / Groß / Sehr groß for genuinely larger public questions, hints, revealed answers and score names
- Hoher Kontrast: flat black public background, white text and yellow public emphasis
- Schließen: dismiss the settings while keeping the selected viewing style

All choices are deliberately **tab-local, nonpersistent and reset on reload/event change**, with no domain command, score writer, host action, source mutation, data migration, public protocol change, broadcast schema change, fake projector-connected claim or new permission. The controls never read unpublished answers, private notes, drafts or original host data. A stale/conflicted projector continues to withhold frames through the unchanged StageViewer.

The expanded settings panel uses native pressed-state buttons, clear focus indication and explicit dismissal. Mobile CSS constrains its width. The normal projector viewport, original G15 stage markup when not opted in, game engines, source rights, consent, offline shell, corrections and stage publication remain unchanged.

## Verification
`e2e/u12-projector-accessibility.spec.mjs` exercises genuine setup, publisher and StageViewer in all five games, comparing public-only text before native reveal, changing accessible font size and contrast, keyboard focus after dismissal, mobile overflow and reset-on-reload. A separate test asserts legacy stage URLs remain opt-out.

Requires exact-head TypeScript, ESLint, Vitest, Vite, real Chromium desktop/mobile/projector and offline PWA checks. G26 physical device, venue readability, editorial rights and owner acceptance remain release **NO_GO**, regardless of passing automated verification.
