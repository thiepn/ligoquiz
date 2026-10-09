# LiGoQuiz 2.0 — Modular Rebuild

**Production:** main (legacy v1.14), unchanged. **Development:** rebuild/v2 and the feature/g4-rundenquiz integration branch.

## What is working in the rebuild

- G1: React, strict TypeScript, Vite, German navigation and game definitions.
- G2: IndexedDB transactional event engine, host fencing, audit, checkpointing, score ledger, idempotency and recovery.
- G3: Public-only same-origin projector transport, late join/ACK/reconnect and disconnect blanking.
- G4: Rundenquiz trial with 3–5 teams, Kurz/Standard/Lang, Wissen/Hinweise/Schätzen/Finale, adjudication, deliberate reveal, score preview, corrections, end standings and host-fenced advisory timer.

The other four games remain unimplemented. The 16 bundled Rundenquiz questions are **provisional test content**, not an audited replacement for the legacy question bank.

## Run locally

Node.js 22.12+ and npm 11:

```sh
npm ci
npm run dev
npm run verify
npm run build
```

Open Spielen → Rundenquiz to configure a trial evening and open Beamer in a separate browser window on an extended display. The G3 projector technical rehearsal remains a separate test surface.

## G5 organizer experience (development)

- `#/spielen`: organizer dashboard, quick start, genuine demo, saved sessions and explicit recovery.
- `#/setup`: three-step setup (teams, program and projector readiness), draft saved locally until confirmation.
- `#/host`: separated private Rundenquiz host workbench; direct access without a selected host session is blocked.
- `#/demo`: one-question **in-memory** trial without IndexedDB scores, history or host session.
- `#/verlauf` / `#/bericht?event=...`: completed local events and result-only JSON export, including exact half-point tie results.
- `#/einstellungen`: default teams, game length and reduced-motion settings.
- `#/technik`: separate G3 rehearsal.
- `#/inhalte`: clearly marked placeholder pending G10, no fake question editor.

G5 builds on the still-unreleased G4 browser-qualification work. Both the standard CI and real Chromium host/projector workflows must pass before merging or announcing the shared experience as verified.

## Safety and current limitations

- The host holds private answers; the projector receives only allowlisted public G3 frames.
- Scoring and corrections commit atomically in the same G2 event transaction; RQ state is not stored in a second application database.
- Refresh during an active Rundenquiz pauses it for explicit host review. The timer reopens stopped with its last saved remaining seconds and never reveals answers automatically.
- No phone buzzers, cross-device session networking, accounts, AI API, production service worker or release deployment.
- The old ligo.quiz.* localStorage remains untouched. Do not use the current production origin for a preview.
- CI validates the technical implementation; human content review, physical projector qualification, accessible interaction testing and first-time host rehearsal remain release gates.

## Development documentation

- docs/G1_STATUS.md — engineering foundation.
- docs/G2_STATUS.md — transactional persistence.
- docs/G3_STATUS.md — projector protocol.
- docs/G4_STATUS.md — Rundenquiz functionality, rules and qualification checklist.

Do **not** merge development into main until BP-06 release gates and migration/rollback acceptance have passed.

## G6 — Quiztafel (development)

- Trial board with exactly N category columns for N=3–5 teams and 3/5/6 rows per Kurz/Standard/Lang profile.
- Private tile selection and deliberate publication; fixed cyclic team selection with exactly one designated steal chance after an unsuccessful primary attempt.
- 100–600 points per tile, no wagers or deductions, correction/annulment audit and exact tied evening ranks.
- Integrated G2 transactional storage with G3 public-only board/question/reveal screens.
- The G5 setup wizard offers a choice of Rundenquiz or Quiztafel, with separate host controls and completed-game reports.
- Thirty provisional Quiztafel sample tiles; not an audited historical question import.

The G6 work is in draft PR #4 based on unfinished G5 PR #3, which depends on G4 browser qualification PR #2. CI must pass after retargeting onto rebuild/v2, followed by projector/device rehearsals. No merge into production main is authorized.

See docs/G6_STATUS.md for detailed rule and acceptance coverage.
