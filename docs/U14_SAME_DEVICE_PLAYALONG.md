# U14 — Same-device spectator play-along

## Problem and transport boundary
The five canonical games have a public projector but no audience interaction. U14 adds a **personal spectator answer pad** at \`#/mitspielen?event=<original-id>\` without creating a second scoring or submission engine. The authoritative host now offers **Mitspielen auf diesem Gerät öffnen** alongside the existing unmodified projector links.

This application currently uses **BroadcastChannel**, a local same-origin, same-browser-profile transport. U14 is explicitly **not a join-by-phone, QR, LAN, or internet multiplayer feature**. Separate devices/browsers cannot receive the canonical stage frames. The UI says so; no server or mock network support is implied.

## Functional audience workflow
A second same-browser tab receives only schema-validated existing \`PublicStageDto\` messages via the existing fail-closed \`StageViewer\`. It shows live public prompts, already-released hints, answer phases, illustrative survey provenance and genuine already-published team scores.

Audience members can type a personal answer (maximum 240 characters), explicitly **Tipp festhalten**, compare their locked text beside the host's subsequently public answer, or edit only before a reveal. This is private freeform speculation: **no accuracy or mastery grading**, no points, no canonical team input, no participation telemetry. The host remains the only publisher and grader.

All five original scene families are supported:
- Rundenquiz public multiple-choice/clue rounds, safe reveal and scores
- Quiztafel board/turn, public selected field, initial or takeover respondent, solution
- Verbindungen incremental clues, sequence and four-group wall
- Logikleiter step/hints, solution/explanation
- Umfrageduell explicitly illustrative or source-qualified public question, category release and scores

Stable local round keys are **derived from already-public prompts**; the spectator never reads private task IDs. The clue/sequence answer transition reuses a prior public-key only within the same active event, game and host epoch. A new task, published scores, pause, unavailable transport, conflict or host takeover clears the tip. A page reload also resets everything.

## Projector-count protection
\`StageViewer\` gained optional \`acknowledgeFrames:false\`, used **only** by \`AudiencePlayalong\`. The original stage viewer's default is unchanged. The play-along viewer still performs strict allowlisted frame validation, ordering, conflict quarantine, stale cutoff and HELLO; it **never sends ACK**, so host \`Beamerfenster bestätigt\` is not falsely incremented by a spectator tab. No source IDs, events, sessions, IndexedDB stores, backups, sync engines, scores, new channels or protocol fields were added.

## Acceptance and release
\`tests/u14-audience-playalong.test.ts\` covers routing, all five source-public-scene families, clue/answer matching, guessing lifecycle, stale/host-epoch failure and disabled projector ACK.

\`e2e/u14-audience-playalong.spec.mjs\` opens genuine host/publisher and spectator tabs, for all five engines, verifies before/after reveal, local tip-locking, non-projector ACK count, mobile width, lost-host privacy and reload wipe. Existing G3/G15 projector and U01–U13 source, browser and installed offline PWA qualification must remain passing.

The established release **NO_GO** remains. This is neither physical venue acceptance nor permission to disclose private question material. Rights, editorial ownership and device tests remain independent gates. Do not merge, deploy, migrate, use production data, or promote the private host on the projector.
