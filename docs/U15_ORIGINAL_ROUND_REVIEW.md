# U15 — Rundenrückblick, original-source completed game review

## Distinct user-facing feature
The original \`#/bericht?event=<id>\` showed final rankings, downloadable score reports and audits, but did not let organizers investigate the actual tasks, correct answers, sources and points progression of a finished evening.

U15 adds a navigable **Rundenrückblick** directly below the canonical final scoreboard for all five original games. Select an original task by play order, filter to one team and/or questions that scored, reveal the original source and full answer on an **explicit click**, and step through previous/next questions with an accessible keyboard-operable control. Each task shows real per-team awarded points and historical running totals; the bottom bars show canonical final raw scores.

- Rundenquiz: original frozen question order, prompts, correct answer, original reference, options/hints/unit and actual award receipts
- Quiztafel: **actual chronological field-pick/outcome order**, selected category, first selector, takeover and recorded winner
- Verbindungen: original assignment order, clue/sequence/16-tile wall solution and source, group links, actual awards (individual or shared wall)
- Logikleiter: original rung/solution, *original* explanation and hint, actual team awards
- Umfrageduell: canonical sample or observed survey rank labels and source provenance; synthetic categories remain explicitly labeled **BEISPIELDATEN**, not real survey responses

## Data authority and gates
\`completedRoundReview(EventRecord)\` is a pure read-only projection. It returns null until **both** original lifecycle and engine phase are complete and the event is not recovery-locked. It uses only canonical original engine source records and award receipts, verifies the expected coverage/IDs and compares accumulated scores against each engine's existing authoritative \`scores()\`. Missing, duplicate, malformed, or conflicting receipts fail closed; no invented points or inferred grader.

No new database stores, commands, awards, timers, schedulers, event revisions, source hashes, exports, network transports or mutations. No spectator/play-along/stage/publisher changes. The feature never renders on the public projector and does not modify existing exports or backups.

Answers remain hidden by default until **Lösung und Quelle prüfen** is clicked in the **already completed local report**. Switching a task/filter clears the shown solution. The existing session history itself is a local-browser archive; this is not a newly claimed authenticated private web service. Original material may still be unreviewed. Existing G26 source rights, owner/venue approval and release **NO_GO** remain mandatory.

## Tests
- \`tests/u15-round-review.test.ts\`: all five original \`createPrepared*\` source preparations, original receipts with cumulative score reconciliation, original editorial reasons/provenance, fixture nonmutation, incomplete/recovery isolation, missing/duplicate/invalid award fail-closed and annulment
- \`e2e/u15-round-review.spec.mjs\`: all five source-backed *synthetic completed-event* browser fixtures created from the app's original setup, original task answer hidden until reveal, next-task reset, real original team filtering, responsive 375px layout, and unchanged IndexedDB original event bytes; unfinished report shows no review

Browser fixture explicitly synthetically marks *prepared* records complete to reach archival UI without pretending it is a genuine completed live-event run. Original live gameplay and score transitions retain their independent G4/G15 qualification. Full original browser and installed offline PWA suites should remain unchanged. Do not mark physical venue rights, audience agreement or real field testing as passed.

Same draft PR #25 and \`design/ligoquiz-3-game-show\` branch only. No merge, deployment, migration, credentials, production data or paid CI.
