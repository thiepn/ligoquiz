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
