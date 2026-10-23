# LiGoQuiz V2 — Host gameplay UX completion (22 October 2026)

## Goal
Keep the existing playful Studio Pop identity and five original engines, but make the current task and **one explicit progression action** visible before scores, custody records, and technical panels. No second command processor, projector transport, grader, source selector or persistent setting is introduced.

## Observed UX problems in original source
1. Each host rendered a four-step rail, full moderation guide, provenance / score review, passive scoreboard and technical status **before** its active question/decision controls. Mobile hosts frequently required scrolling past several panels.
2. Quiztafel and Verbindungen labeled **"correct"** as their sole prominent primary action, even though wrong/no-answer judgments are equally legitimate choices.
3. Rundenquiz / Quiztafel / Verbindungen / Logikleiter / Umfrageduell displayed raw engine phase codes (e.g. \`adjudicated\` or \`wall-reveal\`) in a visible status field.
4. The header unconditionally said *Probeinhalte*, even for original \`*-reviewed-v1\` approved-content events.
5. The shared guide repeated stage and scoring metadata at full size, competing visually with the task.

## Result
- The **original** task cards, questions and decision controls come **before** passive scores, source audit and extra tools across all five hosts. Game action handlers and mounted original components are unchanged.
- The moderator guide begins with **"Als Nächstes: …"** and the human-readable current phase. Actual stage/scoring details remain accessible through a native disclosure; the original projector connection count and keyboard focus-only shortcut remain visible.
- One **progression** action remains prominent for transitions, reveals, confirmations and next tasks. Where the moderator must *judge an answer*, all available decisions are **equal-weight choices**, marked \`data-host-choice\`, with no implied correct/default answer. The focus-only keyboard command finds a legitimate enabled choice or original \`data-host-next\`.
- Original paused/recovery actions remain distinct and guarded. No action runs automatically on scroll, focus, keyboard shortcut or timer expiry.
- Visible phase names reuse the existing \`describeHostStep\` mapping, not a parallel phase authority.
- The local event's original **\`program.rulesVersion\`** distinguishes reviewed from trial content in the host header. This is a label of the existing local editorial state, **not proof of external rights clearance**.
- Mobile touch targets are at least 44px, focus styles remain visible, the active progression action is high contrast, and the five-host layouts remain responsive at 375px and at 200% zoom.
- The previously deployed UX navigation change is repaired: the organizer's newest active session remains available regardless of local search filters. Setup and host pages keep focused context navigation; ordinary pages retain their full mobile navigation.

## Acceptance and safeguards
- Unit: \`tests/ux-host-flow-focus.test.ts\` verifies phase/status text, preserved original publication and scoring boundaries, original review version labels and focus-only safety.
- Chromium: \`e2e/ux-host-flow-focus.spec.mjs\` exercises real native sessions in all five games, 375px host card/score order, next-action focus without dispatch, the actual transition, horizontal fit and Quiztafel/Verbindungen unbiased answer selections.
- Original \`e2e/ux-v2-direct-flow.spec.mjs\` now asserts focused task navigation and full navigation on regular pages rather than expecting removed mobile tabs.
- Full original G14/G15/G26 and offline Chromium suites qualify the same branch head. All original engine/scoring/CAS/source/privacy/backup contracts remain unchanged.

**Release boundaries:** This is for isolated \`ligoquiz-v2-test.pages.dev\`, not a G26 production cutover. Original legacy main and user data remain untouched. Physical venue, rights, and owner approval stay NO_GO.
