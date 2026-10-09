# G10 — Content Studio and Safe Migration (Draft Qualification)

Branch: `feature/g10-content-studio`, stacked on the green G9 `feature/g9-umfrageduell` PR #7. Production `main` unchanged.

## New functionality

- `#/inhalte` is a functional German editorial desk instead of a placeholder: search, game and review-state filters, new-question templates, source/answer editing, advanced validated JSON structure, audit history and changed-content draft reset.
- Five strictly typed task payloads for RQ/QT/VB/LL/UD. Individual validation follows the G4–G9 rulebook; full reviewed-pack selection reruns each game engine's structural validation for a given 3–5-team Kurz/Standard/Lang setup.
- Separate `ligoquiz.v2.content.g10` IndexedDB. No writes to `ligoquiz.v2.sessions` until a user explicitly creates a new approved-content event, which freezes the full content and review fingerprint. Existing events remain unaffected.
- Four-check editorial workflow with reviewer, note (>=10 characters), SHA-256 content fingerprint and revision-fenced transactional edits. Import and changed content always downgrade to **draft**; historic approval never qualifies a question for play.
- Explicit setup source choice: the existing **trial-only** track or **approved-only** track. In approved-only mode insufficient/inconsistent content is a hard error; there is no hidden sample-pack filler.
- Read-only legacy `ligo.quiz.` prefix backup with source origin and SHA-256, including previously unknown keys. Size over 12 MiB **refuses all partial backup**. No unrelated origin keys are touched.
- Untrusted JSON import: 12-MiB limit, max 2,000 records, strict source formats, SHA-256 bundle receipt, preview with source ID and reasoned quarantine, no mutation until human checkbox approval, idempotent import receipts and abort-on-conflict.
- "Undo import" only for unmodified, unapproved imported drafts; entire transaction aborts if any record changed. Audit and quarantined data retained until approved undo.
- Legacy v1 active/completed sessions are archived as raw backup only. Never upgraded or resumed in the new event engine.
- Duplicate-prompt detection, survey provenance requirements, wall-group uniqueness, hint-not-equal-answer checks, QT row-value checks, gameplay-ready coverage check.
- New tests for all five payloads, review fingerprint and edit conflicts, legacy raw backup integrity, import/undo/quarantine and full Chromium editor workflow.

## Deliberate limitations / gates

- Legacy v1 JSON schemas are not assumed. Only identifiable content packets with structurally valid task bodies are mapped; unknown or unparseable records remain visible in quarantine or the unchanged raw backup. **This is not yet a certified complete extraction of all eight v1 families.**
- Human factual review, biblical citations, media licenses, duplicate adjudication, provenance of observed survey data, puzzle uniqueness and stock sufficiency are not auto-certified merely by syntax.
- Editorial "approved" denotes a deliberately attested human checklist; does not constitute independent content audit.
- The v1 original is still source-only and legacy browser data belongs to its original origin/profile. Export each browser profile separately.
- Active session import/recovery, template presets, v1 user review decisions, completed history migration and multi-device import are not authorized automatically.
- G11 must verify actual offline behavior, browser storage permissions, keyboard UX, backup rehearsal and safe SW updates. G12 requires physical projector rehearsal. G13 requires a reversible cutover.
- Do not merge directly to production, change DNS, auto-clear storage or claim the entire v1 bank is ready.

## Rollback

The entire implementation is a stacked feature branch. No production changes. Its new IndexedDB namespace can be left unused or excluded from a preview deploy without affecting existing `ligoquiz.v2.sessions`, legacy `ligo.quiz.*` or `main`. The UI exports the new library and a raw prefix-scoped v1 backup; existing approved event snapshots are immutable.
