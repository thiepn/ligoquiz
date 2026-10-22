# U13 — Five-mode disposable game rehearsal

## Gap
The original disposable demo only exercised Rundenquiz. The game-selection lobby lists five modes, but organizers could not safely try Quiztafel, Verbindungen, Logikleiter or Umfrageduell before configuring a real event.

## Implementation
The existing \`#/demo\` route now has five selectable games. Rundenquiz retains its original disposable engine and established G5 demo. Four new original-engine adapters create \`kurz\` sessions in React memory only, using each mode's existing unreviewed local trial bank and three clearly named dummy teams.

Every practice command calls the real \`transition\` function with current original owner/epoch/revision. Scores call the original \`scores\` function. A private host card gives the moderator source and solution. A separate spectator card derives exclusively from the original \`publicScene\` returned by that game engine; unpublished answers and unpublished survey categories are never supplied to that card.

Participants can rehearse actual game-specific actions:
- Quiztafel: select any available field, release the question, grade the initial answer or an optional steal, reveal, confirm actual award and move to another field
- Verbindungen: publish clues, reveal progressive hints, judge, publish the solution, award; the original wall-specific group and link judgements are also available on reaching the final wall
- Logikleiter: lock independent team answers before or after the hint, release solution, grade teams, confirm exact original 10/5/0 logic
- Umfrageduell: close submissions, assign explicitly illustrative example categories to each team, withhold publication until all are recorded, reveal categories and confirm original rank points

There is no repository, EventRepository, IndexedDB, local/session storage, stage publisher, BroadcastChannel, saved game, score engine or live-host identity in these new adapters. No real event or original backup can be modified by the practice flow. Restart discards current in-memory practice state. Navigation away discards all four modes' data. Full public StageView remains its separate canonical implementation; this is a deliberately *nonbroadcasting* source-backed practice preview, not a second projector.

Original canonical engines, question IDs, source labels, G15 stage screenshot baseline, CORS/permissions, trial-content disclaimer, backup and release NO_GO are preserved. The test banks are unreviewed, and the UI makes no claim of authorized publication or genuine survey respondents.

## Acceptance
\`tests/u13-tryout.test.ts\` exercises real transition safety, original score awards, withheld answers, required survey receipts and mismatched-mode rejection. \`e2e/u13-rehearsal.spec.mjs\` runs the four additional modes in real Chromium, preserves original Rundenquiz demo, checks public/private answer boundaries, 375px layout and absence of event persistence. Existing G5 original demo, full host/projector suites, offline PWA and v2 build remain mandatory.

No merge, deployment, migration, new authority, production writes, stage display changes or G26 release signoff.
