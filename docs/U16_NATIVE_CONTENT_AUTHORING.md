# U16 — Native five-mode source authoring

The original Content Studio exposed only a few top-level inputs for task editing; authoring real hints, sequences, wall groups, ranked survey categories, synonyms, and Logikleiter explanations required hand-editing JSON. U16 supplies a native editable form for **all five existing game modes** using original content schemas and the unmodified ContentRepository.

- Rundenquiz: choose knowledge, four-clue, estimate, or finale; edit original prompt, solution, source, duration, clue array, optional answer choices, and exact numeric estimate/unit
- Quiztafel: category IDs and names, coupled 100–600 point/row selector, exact question and source
- Verbindungen: switch between clues, three-element sequences, and 16-tile/four-group wall; edit source-authored group memberships and accepted alternative links with no invented clues
- Logikleiter: difficulty, original deduction subtype, hint, answer, original explanation, and source
- Umfrageduell: popular/Top 3 formats, five actual rank labels, synonym variants, plus read/edit of already-established observed provenance without quietly declaring an illustrative survey observed

New shapes start with **blank authoring fields**, preventing synthetic sample content from being misrepresented as approved. Existing original top-level task ID is never changed by native forms, nested existing wall IDs are never directly edited, and review flags/observed status are not editable or forged.

The editor is an in-memory projection of the existing original JSON draft. The canonical \`validatePayload\` is the sole save validator; \`repo.saveDraft\` retains CAS/revision history, provenance, fingerprint invalidation, and explicit independent review/approval. Raw JSON remains available under **Erweiterte JSON-Bearbeitung**, including repair of malformed external drafts. Field updates also update that JSON; there is no second store, scheduler, score grader, editor database, item ID mapping, review engine, or migration.

The screen includes immediate actual schema error feedback and a **local preview derived only from author-visible/public candidate fields** (never automatically BroadcastChannel-published, never a stage protocol change). Answer/source remain private to the studio editing form. Responsive 375px layouts, focus visibility and native accessible labels are included; no decorative helper captions were added.

## Tests
\`tests/u16-structured-question-editor.test.ts\` exercises canonical original payload verification, preserved identities, clue/estimate variants, coupled Quiztafel rows, complete 16-tile wall, duplicate group validation, Logikleiter solution/hint discrimination, exactly five survey categories, added synonyms, source/review immutability, and pure copy-on-write.

\`e2e/u16-native-question-editor.spec.mjs\` tests real Chromium editing and persistent drafts in each game mode (not new storage), original save and reload, preview answer exclusion, review not implicitly approved, 375px UI and invalid JSON handling. Existing original G10/G23 content audits, all game engines, G15 projector, U13/U14/U15, G26 release NO_GO and installed offline PWA qualification remain mandatory.

Same original draft PR #25 and branch \`design/ligoquiz-3-game-show\`; no merge, deployment, schema migration, user production data access, credential usage or external content licensing.
