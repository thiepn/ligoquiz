# U17 — Team answer sheets (local, print-only, all five games)

## Missing real-world experience
The U14 spectator answer pad is confined to **another tab of the same browser/device**. It does not connect a roomful of phones and cannot be used as an independent device-network team submission channel. For an actual tabletop quiz, U17 instead equips each team with a physical **answer sheet**.

The current authorized original \`HostCockpit\` offers **Antwortbögen vorbereiten**. Choose all original teams or one team, and 2/3/4 writing lines per task; explicitly open the isolated A4 document and select **Antwortbögen drucken**. Pages have a large original team heading, a numbered answer space per game task, visible boundaries and page breaks, laid out for paper.

- Rundenquiz: original ordered question counts and structural round labels, never the questions/solutions
- Quiztafel: original number of selectable fields, numbered as chronological paper **Spielzüge** rather than falsely implying chosen board order
- Verbindungen: original assigned puzzle sequence, with generic clue/sequence/one shared wall slots
- Logikleiter: original number of rungs, numbered blank challenge responses
- Umfrageduell: original survey count, numbered response spaces with no false survey methodology

These are **blank answer sheets only**. No task prompt or clues, accepted variants, private answers, original IDs, private notes, scores, estimates, unapproved rights or question-bank records appear in generated paper. Only display game labels, task format/count, team names and writing lines. They do **not** act as a score record, attendance system or participation receipt; original host/game engines still alone determine answers, adjudication and points.

## Implementation, privacy and offline
\`originalAnswerSheetPlan\` reads the current in-memory original \`EventRecord\`, pulls only validated team names, original task counts and structural group labels. It returns null for completed, abandoned, recovery-locked or malformed roster events. Output is safely HTML-escaped, independent of the original frozen questions, and bounded into A4 pages without truncating long game profiles.

\`printableTeamSheets\` generates a separate, self-contained HTML print document with no external resource loads. \`TeamAnswerSheetDesk\` produces a **temporary in-memory Blob URL**, which expires when the settings change or the host component unmounts. The separate tab uses \`target="_blank" rel="noopener noreferrer"\`; it cannot inherit a JavaScript \`opener\` reference. Only the authorized original host screen provides this action, not the public \`StageView\`, U14 spectator, completed report or release gate.

There are no new channels, IndexedDB keys/stores, persisted snapshots, database writes, commands, badges, scores, answers, gradding engines, backend, metrics, rights claims, QR/device-network joins, or deployments. Existing G15 projector remains unchanged; print view is not a public projection frame.

## Acceptance
\`tests/u17-team-answer-sheets.test.ts\` exercises all five original prepared event creators, real ordered task count, original roster, private source and answer exclusion, HTML escaping of hostile roster names, immutable originals, one/all team and 2/3/4-line layout, and corrupt/recovery/finished exclusions.

\`e2e/u17-paper-answer-sheets.spec.mjs\` opens the original real setup/host route for each canonical engine and the genuine detached Blob print tab, inspects team pages and document contents, invokes a stubbed print action, checks actual print-media hide rules, exercises mobile 375px one-team/four-line output, ensures original host controls still operate, and rejects forged owner identities.

**Release NO_GO** stays mandatory until source rights, venue and owner acceptance. U17 does not claim physical paper/printer or independent device testing. Same original DRAFT PR #25, branch \`design/ligoquiz-3-game-show\`; no merge, deployment, migrations, credentials, production writes, paid manual CI or costs.
