# U07 — Native Rundenquiz and Quiztafel host gameplay redesign

## Scope
U07 only, on the original LiGoQuiz 3.0 draft. The real Rundenquiz and Quiztafel moderator surfaces beneath the U05 common host cockpit are visually redesigned with U01 Studio Pop and U06 public-stage language. No new game engines, scoring rules, timer authorities, action types, DTOs or storage schema. The remaining three modes and backstage are not redesigned.

## Implementation
- Shared HostGameplayRail derives a display-only four-stage flow (Vorbereiten, Antworten, Werten, Weiter) from each original engine phase. Its guidance uses the existing G14 describeHostStep. Pause and recovery remain explicit, while native host keyboard shortcuts and actions remain authoritative.
- Rundenquiz: game-show heading, authentic score strip, private question and provenance card, original optional persisted timer with a visual meter, real team judgments with selected aria-pressed state, count of recorded team decisions, original award preview, and clearly differentiated confirmation, correction, annulment and pause actions. Hint and estimation rounds use the original forms and engine commands.
- Quiztafel: game-show heading, current selector and canonical board progress, original locally scrollable category board, selected-field state, private prepublication preview, original primary answer and one permitted steal, optional local timer, selected award candidate, original explicit reveal and audited score actions.
- The dedicated host-only stylesheet scopes visuals to the U07 Rundenquiz and Quiztafel components. Public StageView, G14 shortcut styling, G15 projector tests and historical evidence are unchanged.
- All data and actions stay in EventRepository, HostSessionController, HostStagePublisher and original engines, including canonical IDs, revision/CAS, correction provenance, safe reload recovery, local/offline continuity, and G26 NO_GO.

## Acceptance
- New Playwright tests cover real Rundenquiz team judgments and confirmed canonical points, Quiztafel steal and candidate decisions, 375px mobile layout, reduced-motion and original action access, and record new non-golden screenshots.
- Retain and execute original Rundenquiz and G6 Quiztafel tests, G14 host focus, G15 1280x720 public-only projector privacy and 200% zoom host geometry, full Chromium and built offline-PWA regression, strict TypeScript/lint/Vitest/Vite.
- Physical projector and independent source approvals remain release blockers. No merge or deployment.
