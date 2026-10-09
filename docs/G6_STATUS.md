# G6 — Quiztafel (first integrated vertical slice)

Branch: `feature/g6-quiztafel`, based on `feature/g5-shared-experience`.
Not merged to `rebuild/v2`; production `main` remains unchanged.
Rules are BP-03 proposals and content is sample-only, not editorially approved.

## Scope implemented

- Pure typed Quiztafel state machine with saved revision, host identity/epoch, audit and explicit phase commands.
- Board sizes: **N categories** for **N=3,4,5** teams, with exactly **3,5,6 rows** for Kurz/Standard/Lang: 9–30 tiles.
- Each category has precisely one tile at each profile row; tile values exactly 100–600, based on row.
- Selector rotates by fixed team order each resolved tile. Each team gets 3/5/6 selection turns in a completed game.
- Private **PICK** and **UNPICK** are moderator-only; the public projector stays on unchanged board until **PUBLISH**.
- One first attempt with advisory 20-second countdown, no auto-submit or reveal.
- Incorrect/missing first attempt transitions to **steal-offer**, with only the next team cyclically eligible; explicit **OFFER_STEAL** and one 10-second attempt or decline. No third attempt, wager, negative score or selection privilege for the stealer.
- Only deliberate **REVEAL** sends solution to audience; **CONFIRM** awards full tile value or 0, marks tile closed, and atomically records event revision, game outcome, G2 ledger entry, command receipt, checkpoint and audit.
- **CORRECT** voids the prior active ledger entry without reoffering the tile. **ADJUST** can award only a genuinely attempted first or steal response; declined/nonexistent attempts cannot score.
- Explicit reasoned **ANNUL** records a zero-score tile outcome without revealing an unpublished answer; annulled private tiles cannot be reopened by score correction.
- **NEXT** advances selector by one, regardless of the winner; the final NEXT completes the game. Tied game rankings allocate exact integer-half evening points.
- G2 takeover and recovery fence previous host epochs and preserve paused state. G3 projector receives strict public-only board/question/answer/scores DTOs.
- G5 organizer setup now offers Rundenquiz or Quiztafel and creates real authoritative G2 events; history shows completed Quiztafel result-only reports.
- German private host controls, distinct public game board, responsive category grid, public team turn indicator, pause/resume, optional timers, separate projector window.
- Provisional 30-question sample bank across five categories, with informational reference labels. Content has not been editorially audited.

## Test plan

- `tests/g6-quiztafel.test.ts`: full nine profile/team combinations, selection fairness, tile uniqueness, point values, private unpublished content, single steal, declined steal rejection, correction, annulment, pause, integer half-point tie allocation, atomic G2 outcomes, retries and takeover.
- `e2e/g6-quiztafel.spec.mjs`: live Chromium host and projector, private picked tile, public reveal, one steal, score correction, next team, and reload-to-paused recovery.
- Strict types, lint, unit tests, production build and real browser tests must pass on the final commit. Old G1–G5 regression suites remain required.
- Physical-projector rehearsal, editorial verification, timings across 3/4/5 teams and usability testing remain future gates.

## Known gaps / deliberate exclusions

- Quiztafel currently supports one standalone game per evening, not mixed five-game programs; multi-game event aggregation follows after G7–G9.
- Timers in this version are local advisory UI and reset to the full 20/10 seconds when the host reopens a paused attempt. They never fire a game-state command. A resilient persisted countdown can be incorporated in device hardening if required.
- The 30 sample questions are provisional, not the vetted legacy database, and should not be advertised as fact-checked or professionally calibrated.
- The board has no participant-device answer entry; oral answers are judged by the host.
- A revoked/replaced host epoch cannot keep scoring; physical projector disconnection is handled by G3.
- Do not merge to production `main`, modify GitHub Pages/DNS, or overwrite legacy `ligo.quiz.*` browser data.

## Branch dependency

1. Qualify and merge G4 browser hardening PR #2 to `rebuild/v2`.
2. Rebase/qualify and merge G5 PR #3 to `rebuild/v2`.
3. Retarget and qualify G6 against updated `rebuild/v2`, then merge G6.
4. Only then consider G7 Verbindungen. None of these stages constitutes the v2.0 production release.

## Acceptance / manual dry run

Select 3, 4 or 5 teams, choose Quiztafel Kurz/Standard/Lang, begin the board and open the projector in a separate extended-display window. Privately select and cancel a tile without stage disclosure; reopen/publish explicitly; judge a correct first answer; then repeat with a failed primary attempt and the single designated steal. Verify full points only to the winner, cyclic next selector, no repeated tile, corrected scores, zero-score annulment, reload pause, host fencing, and stage blackout on disconnection.
