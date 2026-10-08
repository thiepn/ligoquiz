# G2 — Transaction engine and IndexedDB

Branch: rebuild/v2. Production main and its GitHub Pages site remain unchanged.

## Implemented

- Zod-validated session snapshots, host command envelopes, score outcomes, checkpoints and audits.
- Pure lifecycle transitions for deliberate question, hint and answer publication.
- One atomic IndexedDB transaction per committed command; receipts, events, outcomes, checkpoints and audit share one write transaction.
- A command retry with the same identity/epoch/payload returns an existing receipt without replaying effects.
- Logical score outcomes are unique; corrections use auditable OUTCOME_VOID and OUTCOME_RESTORE commands.
- Revision and explicit host-epoch fencing; a takeover pauses a live event and invalidates old host commands.
- Corrupt snapshots can only recover from a same-revision checkpoint, then enter paused review-required mode.
- Public-stage projection is an explicit validated allowlist; no private answer published before host reveal.
- Score summaries and their session revision are read in one IndexedDB readonly transaction.
- A small HostSessionController reports only committed results to future stage subscribers.
- Unit and fake-IndexedDB integration tests exercise concurrent retries, invalid commands, audit corrections, injected write failure, safe recovery and privacy.

## Deliberate exclusions

- G2 is not yet a playable app. The app shell continues to show disabled game actions.
- G3 adds actual host/projector BroadcastChannel synchronization and UI integration.
- G4-G9 add game-specific state machines and moderator workflows.
- G10-G13 add legacy data migration, PWA delivery, device and release qualification.
- No automatic takeover, silent recovery, use of legacy browser storage, or deployment to production.

## Acceptance

Run npm ci, npm run verify and npm run build. A completed green GitHub Actions run on the final G2 commit is required before labeling G2 verified.

## Safety invariants

1. No success acknowledgment until the IndexedDB write transaction completes.
2. Commands are optimistic-concurrency checked and fenced to a single host epoch.
3. Reusing a command ID with different logical intent fails.
4. Audience answers are published only after persisted explicit reveal.
5. Audit and score changes roll back together on any storage failure.
6. Historical disclosure is not retractable by simply restoring an old screen.
