# G15 — Real-browser projector legibility and host accessibility

Based on qualified G14 draft PR #12 at exact head `18cc85dff54f6d842cd3415b639f902171116165`.

## User-visible changes
- Public-only stage CSS recalibrates 1280×720 projector board typography, spacing, the 4×4 connections wall, five-response survey reveals, answer cards, and scoreboard layouts.
- Improves completed Quiztafel tile contrast and projection header/footer colors; protects long words and team names with wrapping.
- Stage content gets a bounded scrolling fallback for unusually long editorial material instead of silently clipping; actual short-profile projector scenes are browser-asserted to fit without vertical scrolling.
- Every host gains 44px-minimum clickable controls, high-visibility keyboard focus, responsive team grids and an independently scrollable Quiztafel board at mobile/200%-zoom sizes.
- G14 global keyboard focus shortcut no longer steals keys from active input, select, textarea, contenteditable or dialogs.
- Public stage root advertises **only its already-allowlisted scene kind**, including `withheld`. No host identity, frozen solutions, raw answers or unpublished payloads are added.
- Five mode real-browser tests use separate stage windows at 1280×720, assert no unexpected page or content overflow and pre/post-publish private-answer exclusion, then simulate 200% host zoom. They save non-golden PNG evidence for manual inspection on successful CI.

## Evidence and restrictions
- CI screenshots are reproducible browser-synthetic observations, not physical 1280×720 projector/venue approval.
- No updated screenshot goldens, no scoring changes, no human approvals, no merge/deploy/DNS/migration.
- Human physical projector inspection, venue fonts, hardware and assistive-tech tests, content/editor signoffs, and owner release authorization remain OPEN.

## Next G16 — Moderator Decision Clarity and Visual Acceptance Reconciliation
Objectives: based on G15 screenshot evidence, remove cramped/failing areas, enhance noncommitting score-delta inspection and error recovery, add versioned visual-evidence acceptance metadata with strict human approval gates. **Not started.**
