# LiGoQuiz V2 — Existing trial content to G10 editorial drafts

The five existing code-owned original trial banks may now be explicitly prepared for editorial review: Rundenquiz 16, Quiztafel 30, Verbindungen 16, Logikleiter 7 and Umfrageduell 10 (79 total).

In `#/inhalte`, **Probeaufgaben als Entwürfe prüfen** produces deterministic bytes for the original G10 checksum preview. The preview shows typed candidates, source collisions and quarantines. It does not write anything before the existing checkbox and explicit confirmation. Imported items remain status `draft`, have no reviewed permissions or factual claims, and retain their source code paths and stable original question IDs under `origin: sample`. The SHA-256 receipt, IndexedDB transaction, concurrency fences, idempotency and guarded import undo all come from G10, not a second storage engine.

A synthetic in-memory approval in unit tests checks that the trial structures satisfy each of the five canonical *long, five-team* engine contract shapes. It does not authorize any real or stored trial questions. The real 79 questions are not an independently verified/rights-cleared library, are not a v1.14/704-question migration, and do not become a verified real survey. The Umfrageduell trials remain expressly `illustrative`.

G23 source/citation/rights audit, the original G10 four-check human review, approved-only pack selection and all existing session/projector/offline/backup protections remain unchanged. No production deployment, legacy data mutation, content permission, automated release or migration is performed.

## Source-specific editorial review

The existing Inhaltsatelier includes a Quellenprüfung group. Four exact,
unchanged original Rundenquiz trial items have official primary-source research
leads: rq-w4 — Austrian RIS B-VG Art. 5; rq-w6 — NASA Mercury;
rq-s1 — BIPM SI Brochure; rq-s4 — World Athletics Marathon. These official
sources are starting points for independent answer and reference checks,
not automated verification, copyright clearance, or proof of editorial approval.

These leads are tied to source ID, trial-bank provenance and complete original
question payload. Editing the question, answer, reference or source identity
invalidates the previously attached source lead. The other 65 sample items
require source research, while 10 Umfrageduell items are separately identified
as illustrative rather than measured surveys.

The integrated queue opens the existing question editor and reuses G23 issue
flags; the original four human checks remain mandatory. Review steps cover the
precise passage, accepted answers, ambiguity, fair grading and rights evidence.
Neither external URLs nor this queue write approvals, modify scored events or
change the NO_GO release decision.

## Source-backed question repairs — original trial version 2

- `qt-geschichte-4`: The original 79 CE question admits both Pompeii and
  Herculaneum. UNESCO confirms both were buried, while Pompeii's forum
  and amphitheatre distinguish the intended answer.
  Source: https://whc.unesco.org/en/list/829/
- `qt-geschichte-5`: Calling Byzantium only an ancient empire suppresses
  its medieval duration. The Library of Congress confirms that the empire
  continued to 1453 with Constantinople as capital.
  Source: https://guides.loc.gov/byzantine-empire/introduction

The original question IDs and engine shapes remain unchanged. The trial intake
source version changes to v2 so old imports are never silently overwritten;
their IDs collide safely in the existing preview/quarantine gate.
For an older exactly-matching v1 editorial record, the existing editor offers
an explicit source-linked correction to **prepare in the editor only**. The
operator must still save the revision as a draft through the unchanged CAS
repository. Edited variants and unknown provenance do not qualify. Neither
correction grants any fact/rights approval. Source-review search filters the
same live queue without a parallel scheduler or database.

## Cross-game clue reuse review

The original trial banks independently contain the same reveal answers in
Rundenquiz `rq-h1` / Verbindungen `vb-a-david`, `rq-h2` /
`vb-a-ester`, and `rq-h3` / `vb-a-petrus`. During one event a
previously revealed answer may spoil a subsequent clue task. The existing G23
read-only audit now records six reciprocal, nonblocking
`CROSS_GAME_CLUE_REUSE` review flags with the exact related original IDs.

In the G10 source queue, filter by **Nur wiederholte Hinweisziele** under
Quellensuche, then use **Zugehörige Frage öffnen** to inspect the paired item
and decide whether to separate, replace or schedule it differently.
No content is auto-rewritten, rejected, approved or published, and no second
scheduler or scoring engine is created. A different answer target removes the
flag; unrelated game types and same-game hints do not create this cross-game flag.

## Local research worksheet (CSV)

The source review queue exports either the filtered research worklist or all local
drafts on explicit button activation. The CSV contains questions/clues, answers
(or the explicitly illustrative survey categories), original source text,
source-lead URL where applicable, G23 audit flags, duplicate/reveal-related IDs,
the source file/version and any **self-asserted** rights note. Five columns for
answer, citation, rights, host fairness and editorial decision are **blank**.

The worksheet is a local file with raw question/answer text. It is not the
redacted G23 publication-safe issue index; do not distribute it as if it were
rights-cleared. The app does not upload the CSV, import reviewer-filled cells,
change content state or emit any factual/rights approval. Quotes, line breaks
and spreadsheet formula-style cells are escaped for safer spreadsheet inspection.
Original G10 CAS, manual review, backup and G26 NO_GO remain unchanged.

The worksheet includes all playable prompt details (clues, sequence items,
choices, extra hints, wall tiles), solution/explanation context, and for
any genuinely observed survey the entered method/population/date/limitations.
This is copied as unverified source data, never independently certified.

## Six additional official-source research leads and citation staging

Exactly source-matched research leads now cover 12 original trial questions.
New: `qt-natur-1` NASA Sun Facts, `qt-natur-2` and `qt-natur-6`
IUPAC periodic table, `qt-natur-5` BIPM SI Brochure, `qt-geschichte-2`
German Federal Government Wall opening (9 November 1989), and
`qt-geschichte-3` Federal Chancellery's Konrad Adenauer profile.
The remaining 57 originals need source lookup; 10 Umfrageduell ranks remain
purely illustrative.

On an unchanged first-party question only, the editor can explicitly
prepare a specific official-source link in the unsaved reference field.
The original editor and G10 Save as Draft remain the only persistence
mechanism. The original source fingerprint stops matching on modification.
Already-linked, edited, provenance-substituted and non-question items cannot
repeat this operation. The source text still needs independently reviewed
passage accuracy, answer variants, rights and manual approval; staging
does not certify, store rights, publish, fetch external pages or approve.

## Reopen offline editorial worksheets (local read-only handoff)

CSV review worksheets exported from the same original 79 draft records can now
be reopened inside the existing G10 Quellenprüfung. This is a volatile local
preview, not a content import: only the final five reviewer-filled columns
are surfaced. The importer accepts strict quoted CSV with UTF-8 BOM, multiline
cells and commas; rejects invalid schemas, duplicate IDs, overlong fields and
files above 1 MiB.

For each annotated row, the app compares the original exported question text,
answer, reference, status, source lead, rights claim, file path and source
version with the **current** G10 source task. Unchanged rows can open the
existing editor. Changed/missing rows remain visible but their navigation is
disabled. Reassessment is reactive after a draft save, so old notes become stale
when the associated answer or source is edited. The CSV is held in memory
for this browser view only, cleared by the Close action, and never uploaded
or written to IndexedDB.

Imported claims of review, correctness, rights or approval are displayed solely
as untrusted notes: they cannot set checklist flags, reviewer identity,
approval, source rights, CAS revision or production release. Existing manual
G10 review and G26 NO_GO remain authoritative.

## Stage an offline reviewer source URL in the original draft

A reviewer may put precisely one HTTPS URL into the existing **Beleg geprüft**
column of the exported CSV. Reopening a matching non-survey draft shows
**Quellenlink im Entwurf vorbereiten**, appending that URL to its existing
reference in the **unsaved** G10 editor only. No third-party fetch, source
verification, approval, or rights authorization occurs.

The action refuses stale/missing records, already-present URLs, approved or
in-review items, illustrative surveys, invalid/non-HTTPS links, credential-bearing
URLs, and strings beyond the original 1000-character source contract. It also
blocks navigation and staging when the current editor has outstanding question,
rights, reviewer or checklist edits, to avoid losing unsent work.
The original explicit Save as Draft with revision CAS remains the only write.
G26 publication stays NO_GO.

## Reviewer answer suggestions in original G10 editor

In a CSV worksheet, an editor may write "Vorschlag: neue Antwort" in
Antwort geprüft and a single valid HTTPS source link in Beleg geprüft.
For an exact matching, still-unapproved original question the G10 source
worklist displays previous versus proposed answer. An explicit action
prepares both the new answer and citation in the UNSAVED native editor.

Only valid single-line answer proposals (up to 500 characters) are
accepted for Rundenquiz, Quiztafel, Logikleiter, Verbindungen clues and
Verbindungen sequence. Umfrageduell illustrative/observed ranks, wall
puzzles, modified or missing records and non-draft items cannot take this
shortcut. The original G10 game schemas validate staged content; existing
unsent edits/reviewer data must be resolved before switching questions.
Manual Save as Draft with revision CAS is the sole persistence path.
The reviewer note and its HTTPS citation are not fact, rights or content
approval. Original IDs, grading, engine contracts and G26 NO_GO remain.

## Reviewer-led prompt and four-clue wording corrections

The existing CSV review column `Spielleitung geprüft` can now include
`Fragevorschlag: <new prompt>`, or, for original four-clue items,
`Hinweis 1: <new clue>` through `Hinweis 4: <new clue>`.
Each proposal requires a separately entered valid HTTPS citation in
`Beleg geprüft`, an unchanged exact-question snapshot and an original
unapproved draft. G10 shows the old and suggested wording with a
single explicit action to stage the original question's new prompt (or one
clue) and source in the **unsaved** native editor. An optional separately
marked `Vorschlag: <answer>` is staged in the same revision, not dropped.

Rundenquiz, Quiztafel and Logikleiter support question prompts; Verbindungen
sequence supports its original prompt; Rundenquiz hint rounds and
Verbindungen clue puzzles support one of their four original clues.
No rearrangement of other clues, answer engines, wall groupings or survey
responses occurs. Original game validation runs before showing the action.
Stale or missing records, changed provenance, unsupported formats,
source-less submissions, incorrect answer proposals, invalid control
characters or lengths are rejected. All pre-existing unsent G10 editor
changes must be dealt with before staging another question. The only
persistence path remains an **explicit** G10 Save as Draft with CAS;
reviewer evidence is unverified, rights/approval are not inherited and
G26 release remains NO_GO.

## Source-linked original puzzle-detail correction

For original non-survey questions still in G10 draft status, the offline CSV
`Spielleitung geprüft` field now accepts **up to six separate lines** naming
targeted corrections with an unchanged source-grounded question fingerprint:
`Zusatzhinweis: ...` and `Erklärungsvorschlag: ...` for Logikleiter;
`Folgenelement 1: ...` through `Folgenelement 3: ...` and
`Erklärungsvorschlag: ...` for Verbindungen sequences;
`Wandfeld 1: ...` through `Wandfeld 16: ...` and `Verbindung 1: ...`
through `Verbindung 4: ...` for the existing Verbindungen wall. A reviewer
must also provide a valid HTTPS URL in `Beleg geprüft`.

The author sees a per-field **before/after** comparison and may explicitly
stage the whole correction batch into the **unsaved** original G10 editor.
The source-backed validator rejects duplicate or unknown fields, unchanged
values, invalid game schemas and a second field with a conflicting answer
proposal. Wall revisions preserve the original 16 tile IDs, group IDs and
group memberships; a renamed group title is appended to its pre-existing
accepted links only when the original 15-synonym limit permits it.
No new puzzle engine, source authority, scored-content publication or
new persistence is introduced: original G10 draft save + CAS, four-check
manual rights/editorial review and G26 NO_GO remain intact.
