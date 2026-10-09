# G9 — Umfrageduell development qualification

Stacked after G8: feature/g9-umfrageduell -> feature/g8-logikleiter. This is a trial vertical slice, NOT a production release.

## BP-03 implementation
- Three to five teams share an ordered 4/6/10-task survey game:
  Kurz 4 Beliebteste Antwort, Standard 5 + 1 Top 3, Lang 8 + 2 Top 3.
- Beliebteste Antwort: one answer, host maps to canonical ranks 1..5; 20/15/10/5/2, outside/absent 0.
- Top 3: three ranked answers. For each of real canonical top three: correct position = 10, different position = 5, not included = 0. Duplicate mapped category counts only on its first occurrence. Max 30.
- Teams give written/oral answers; host **closes submissions**, records original words and manually adjudicates canonical category. Exact synonym matches are suggestions, not irrevocable automatic grading.
- Five distinct answer categories per task, cross-category canonical/synonym uniqueness, observed-source metadata validation; built-in offline pack is **illustrative only**.
- All public initial prompts and reveals explicitly label **BEISPIELDATEN – KEINE ECHTE UMFRAGE**. Never claim fabricated statistics were measured. The packaged pack does not invent percentages or respondent counts.
- Rankings are private until all team responses are recorded and host explicitly reveals. No answer mappings, unpublished categories or host data in public payloads. Scoring commits only after explicit reveal.
- Host can correct a recorded graded answer via documented reason; exact ledger entries void/reissue atomically, with original words, mappings and reason in the audit/session. Reasoned annulment zeroes all teams.
- 30 seconds for Beliebteste Antwort; 60 for Top 3, advisory only; no auto-close, reveal or scoring.

## Engineering
- Pure game engine and zod-checked session/command types: src/games/umfrageduell.
- Offline provisional task pack: src/games/umfrageduell/trial-bank.ts.
- G2 one-transaction session/revision/outcome/audit/checkpoint receipts, idempotency and host-epoch fencing.
- G3 projector allowlist and explicit public provenance badge.
- Organizer wizard, saved sessions, progress, final report, host controls and matching responsive Stage design.
- Test matrix covers 3/4/5 teams, 3 profiles, both formats, zero/duplicate scoring, source preflight, private reveal barriers, corrections, IDB replay/takeover and Chromium projector.

## Qualification boundaries
- Editorial approval of survey categories, synonym handling and empirical sourcing not yet performed. The local starter set is for rehearsal only.
- Physical 1280x720 projector, accessibility, offline persistence with loss of all power, full application security and live real-audience rehearsal remain G11/G12 gates.
- Do not merge to main or publish without G4B->G5->G6->G7->G8 upstream integration and final human acceptance.
- Next: G10 content editor and migration/replacement of provisional packs.
