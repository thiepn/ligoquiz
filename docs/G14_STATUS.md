# G14 — Faster Moderation & Accessible Host Controls

**Status:** stacked draft based only on qualified G13 PR #11 at `51fa84fa3f7e143c9b0e16a91c0a8da11307858e`. No merges, deployment or migration.

## Delivered source scope
- New shared, host-only moderator guide across all five engines: next deliberate action, phase, private/released-answer state, committed/uncommitted score state, completed task progress, and count of confirmed projector viewers.
- Recovery, pause, completion and active phase have distinct guidance; the guide never advances a command or reveals a private answer.
- Accessible `Alt+Shift+N` focus-only shortcut and a pointer/keyboard focus button; neither may commit or reveal. The original game engine remains the only authority.
- Main game controls gain explicit focus targets, and resumed paused games have explicit focus targets. Quiztafel's selection grid supports focus when no primary action exists.
- Adaptive 200%-scale compact cards and min-44px control, visible focus outline, no generic overlay obscuring game controls.
- Unit matrix for all five games and browser tests on genuine setup/host route for each game, including keyboard no-mutation and narrow simulated zoom.

### Confirmed G12 Quiztafel reload race repaired
- G14 full-browser regression exposed a real G12 Quiztafel 3-team reload: concurrent same-host pauses could cause STALE_REVISION and leave the resumed host without controls.
- The new bounded `loadSafelyPausedQuiztafel` reconciles only STALE_REVISION by reloading validated state and pausing when necessary. It never retries STALE_HOST or authorizes an automatic resume.
- Unit regressions cover concurrent restart and ownership fencing; dedicated G12 3-team browser rehearsal now precedes the full Chromium suite.

### Approval and privacy
The original confirmation/reason prompts for actual recovery, correction and cancellation stay authoritative. No new automatic confirmation is substituted for the explicit reveal and score buttons. Host guide never enters the public stage allowlist and does not handle answers. Existing scoring, audit, event storage, offline, and human signoffs unchanged.

### Required qualification
Exact-head Verify v2 and Chromium + offline-PWA workflow jobs, final sha, full failure inspection, no skipped tests or screenshot-golden changes. Human device, projector, accessibility and editorial signoff stays OPEN.

### G15 — Game-Night Readability & Accessibility Acceptance
Next objectives: human-usable 1280x720 projector legibility tests, host large-text accessibility, stronger decision previews with provenance, genuine screenshot acceptance and game-night QA regression. **Not started.**
