# U08 — Native Verbindungen and Logikleiter host redesign

U08 redesigns only the real moderator interfaces for Verbindungen and Logikleiter, extending the U07 display-only four-step HostGameplayRail with original G7/G8 phases. Existing Rundenquiz, Quiztafel, Umfrageduell, StageView and the strict public DTO stay unchanged.

Verbindungen presents progressive clue count and source-backed private answer, sequences, 16-tile wall, canonical group-reveal progress and marked-team count, selected group/link decisions, award preview, original local timer and deliberate moderation controls. An original aria-pressed discrepancy is corrected: before a link answer is recorded, its Nicht richtig button must not report pressed.

Logikleiter presents active rung and original point values, team lock counts and early/late submission status, public hint visibility, private solution, decision count, original grade buttons and canonical awarded scores. Reasoned correction, annulment and fair-hint action logic is unchanged.

Native game engines, HostSessionController, EventRepository, CAS/revisions, IDs, source rights, recovery, backups, local/offline and public projector publication remain untouched. CSS is scoped to the two U08 hosts, with reduced-motion and 375px treatment. New screenshots are non-golden and do not replace historical G15 evidence.

Qualification: exact-head TypeScript/ESLint/Vitest/Vite, original G7/G8/G14/G15 browser and offline tests, new U08 real clue/wall and rung scoring plus 375px mobile tests. Physical venue, projector hardware and human source approvals remain G26 NO_GO. No merge, deploy, migrations, production writes, credentials or costs.