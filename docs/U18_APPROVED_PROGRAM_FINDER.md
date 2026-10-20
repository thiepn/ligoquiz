# U18 — Approved program finder in original game setup

## User-facing problem
The original \`#/setup\` offered "Redaktionell freigegebene Inhaltsbibliothek" for all five games, three profiles and 3–5 teams without indicating whether that particular approved pack could actually start. Failure appeared only *after* checking the projector acknowledgement and selecting "Spielleitung öffnen". This wasted organizer preparation and made it difficult to find a playable alternative.

U18 adds **Freigegebene Programme** directly under the original source selection in step 2 ("Programm wählen"), shown **only when** the organizer explicitly selects reviewed-library mode. It checks all 45 original game/profile/team combinations using the **existing** \`selectReviewedPack\` and \`coverage\` functions, shows the current combination and the exact missing required category counts or actual structural rule rejection, and displays **only genuinely eligible alternatives**. One click explicitly changes only the *existing setup draft* game/profile/team count. Existing roster names and step navigation persist; no source is automatically approved, no live event starts, and there is no switch to trial mode.

The organizer can choose **Bestand neu prüfen** after working in the original Inhaltsatelier. This performs a new read-only \`ContentRepository.list()\`, preserving original IDB lifecycle. Unavailable or corrupt local library does not produce a "ready" state.

## Authority, privacy and rights
A pack is eligible only if each item's status is currently \`approved\`, it has an original review receipt and its exact serialized payload SHA-256 equals that receipt's fingerprint. Modified, quarantined, unreviewed, or tampered content contributes **zero** eligible items. Thereafter the canonical game-specific \`selectReviewedPack\` verifies real sets, including original Quiztafel category/row integrity, Verbindungen/team coverage, Logikleiter rung rules, Rundenquiz/Umfrageduell bank correctness. This is deliberately stronger than raw counts alone, without writing a duplicate selector or grader.

**Actual event creation remains wholly delegated to the unchanged \`createPreparedApproved\`**. It rereads the original library and rechecks exact hashes, original CAS/session creation and frozen IDs at final start. The U18 read-only selection snapshot cannot replace that authority, and may become stale if another tab edits a source after the user's preflight—final launch still fails closed. No fallback to trial sample content is added.

The finder neither reads the actual quiz solutions for display nor exposes item IDs publicly: current selection shows original game name/profile/team count, missing category counts, or selector rejection; alternatives are explicit buttons. It exists only in local organizer setup, not the public stage, spectator, printer, rehearsal or release system.

## Original-source regressions
- \`tests/u18-approved-program-finder.test.ts\`: 45 configurations; all five canonical original banks; true shortage vs misleading raw-coverage Quiztafel structural failure; cryptographic approval-fingerprint mismatch; review-only drafts excluded; current selection identity, no source mutation.
- \`e2e/u18-approved-program-finder.spec.mjs\`: real Chromium failure with an empty library and retained original no-trial-fallback; original prepared Logikleiter question sources used to build **disposable synthetic approved fixture receipts in an isolated test browser only**, then genuine finder one-click choice, setup reload and original \`createPreparedApproved\` final session/frozen source ID+SHA handoff; tampered SHA denial and 375px mobile fit.

The synthetic E2E approval fixture is test-only, not evidence of actual editorial rights or human review.

G15 original projector, original five engines, U13–U17, CAS, host identity, offline backup, content review, provenance rights and G26 **NO_GO** remain unchanged. Same draft PR #25 and original \`design/ligoquiz-3-game-show\` branch only; no merge, deployment, migration, credentials, production writes or manually requested paid CI.
