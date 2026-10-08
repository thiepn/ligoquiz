# LiGoQuiz 2.0 — G0 Implementation Readiness

**Date:** 2026-10-08  
**Status:** Engineering baseline secured; product sign-off pending.  
**Scope:** Planning, branch isolation, source identification. No production app changes.

## Pinned legacy baseline
- Exact commit: `f70e73f3c5b740ad3baf9580431f8393246b4eb0`
- `main`: remains on the legacy v1.14 source; do not merge unfinished work.
- `archive/legacy-v1.14`: archival branch at pinned baseline.
- `rebuild/v2`: isolated v2 rebuild branch.
- `index.html`: 1,435,548 bytes, Git blob `0dc9c86abd4bda3b67fb7f4774429ba04578c76f`.
- `README.md`: 1,050 bytes, Git blob `da7ad6106b29dc6597df737f190ea4cc3dd42131`.
- Legacy question count 706 total / 704 active is metadata only, not a validated corpus.

## Authority hierarchy
BP-01: scope; BP-02: UX journeys and S01–S24; BP-03: game rules and scoring; BP-04: Studio/Control/Stage visual reference; BP-05: technical contracts; BP-06: migration, release gates and rollback.

## Implementation invariants
- Five games, German UI, 3–5 teams, 1–5 game instances.
- One write-authorized host. All reveals and score commits deliberate and idempotent.
- Private event state never sent to the read-only projector view.
- Game rules independent of React. Exact half-point event ranking; tied placements permitted.
- Versioned, validated content and frozen per-event question assignments.
- Offline-first, durable recovery; no force-update during a live event.
- Old browser data (`ligo.quiz.*`) stays untouched until read-only export, preview and explicit owner import.

## G0 human decisions remaining open
- Owner approval of BP-03 scoring profiles, steals and hint mechanics.
- Owner review of BP-04 screen designs on real hardware.
- Verification of actual deployed origin and browser profile containing organizer data.
- Hardware/browser matrix and editorial approval of imported question bank.
- Dexie vs native IndexedDB and PWA update semantics require G2/G11 spikes.

## G1 entry contract
Work on `rebuild/v2` only. Establish Vite, React, strict TypeScript, isolated domain engine, typed stage-only DTO, format/lint/typecheck/tests, CI build, and separate preview scope. Do not deploy rebuild branch to production GitHub Pages. G1 is blocked if source changes affect `main`, production service worker scope, or legacy local storage.

## Completion status
Technical preparation performed; **G0 is not owner-approved**. Do not call the v2.0 app implemented or released. Full BP-01–BP-06 and G0 artifacts are distributed in the ChatGPT blueprint package.
