# G7 — Verbindungen vertical slice

Branch: `feature/g7-verbindungen` → `feature/g6-quiztafel` (stacked PR). Production `main` unchanged.

## Official mechanics (BP-03)

- Exactly 3–5 teams with frozen equal puzzle assignment.
- Kurz: **one Vier-Hinweise puzzle per team**, no sequences, one shared 16-tile wall.
- Standard: **one Vier-Hinweise + one Folge ergänzen per team**, plus shared wall.
- Lang: **two Vier-Hinweise + one Folge ergänzen per team**, plus shared wall.
- Part A: four incrementally published clues, one locked final guess, 40/30/20/10 for correctness at clue 1/2/3/4; wrong/no answer 0. No steal.
- Part B: a three-term sequence with a publicly visible unambiguous rule, one answer, +20 correct else 0, no steal.
- Part C: 16 immutable shuffled tiles, four disjoint groups of four, common 180-second advisory limit. Four groups are explicitly revealed **one at a time after simultaneous answers close**. Each team is independently marked per group: +5 exact four-tile group, another +5 for an accepted link to that correct group. Maximum 40 per team; wrong groups yield no partial points.
- Clue and sequence timers are optional (30 seconds/clue, 45 seconds/sequence); timer expiry never judges, reveals, changes stage, or awards points.
- Correction voids previously committed G2 ledger awards, leaves historical audit intact, and reissues revised outcomes atomically. Reasoned annulment awards 0, does not reveal unpublished answers, and cannot be corrected to leak an unpublished solution.
- The event-level integer half-point tie normalization is calculated from each game's raw totals.

## Implementation

- `src/games/verbindungen/engine.ts`: typed pure domain engine, profile preflight, stable assignments, private response judgments, wall per-team group/link marks, score and projection reducers.
- `src/games/verbindungen/trial-bank.ts`: **provisional** 10 clue puzzles, 5 rule-constrained sequences, and a shuffled four-group wall; not an approved imported question bank.
- `src/games/verbindungen/schema.ts`: strict Zod snapshot/command validation, immutable task order and board structural checks.
- G2 `EventRecord.verbindungen` and `VB_ACTION`: commands use a single host epoch and event revision; outcome, audit, receipt and snapshot commit in the same IndexedDB transaction. Recovery and host takeover fence previous host identity.
- G3 `derivePublicStage`/StageView: only released clues, sequence terms, wall tile labels and explicitly revealed group tiles/links appear in public DTOs. Private answer keys, moderator notes, grading and unrevealed group assignments are excluded.
- `src/features/host/VerbindungenHost.tsx`: real moderator flow: start, publish, reveal clues, lock single guess, manually grade, show solution, confirm/correct/annul, group-by-group wall scoring and end standings.
- G5 wizard permits Verbindungen and freezes puzzle assignments, session history and reports show results only.
- Distinctive dark graphite/gold wall stage and a lighter private host workspace with responsive layouts.

## Verification

- `tests/g7-verbindungen.test.ts`: nine complete n=3,4,5 × Kurz/Standard/Lang game simulations; turn balance; unique wall grouping; stage reveal privacy; one final guess; no group link without complete group; annulment; game-end tie ranks; G2 atomic correction/retry; explicit host takeover.
- `e2e/g7-verbindungen.spec.mjs`: browser host + second projector window; incremental private-to-public clues, one-guess lock, correction, shared 16-tile wall group reveals and team scoring, and reload-to-pause safety.
- Must pass TypeScript, lint, unit tests, production build and Chromium browser flows on the **final commit** before merger. The upstream G4–G6 regression suite remains mandatory.
- Physical two-monitor rehearsal, content editorial signoff, accessibility and offline/PWA readiness are NOT verified and remain later release gates.

## Dependencies and limits

- G4 browser qualification PR #2, G5 PR #3 and G6 PR #4 remain upstream of G7. Do not merge out of order.
- Stand-alone single-game event only until G8/G9 and shared multi-game program aggregation. No participant devices, phone buzzers, runtime accounts or paid AI API.
- Not an audited replacement for the v1.14 question library. No changes to main, GitHub Pages, DNS or legacy localStorage.
- Host UI uses local advisory countdowns. Reload pauses the game and resets the host-only optional clock; no automatic stage actions.

## Next

Qualify and merge the upstream PRs, retarget G7 to `rebuild/v2`, ensure both workflows pass after rebase and perform rehearsal. Then G8 — Logikleiter.
