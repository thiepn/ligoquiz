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
