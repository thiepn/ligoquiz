# LiGoQuiz 2.0 — Modular Rebuild (G2)

Working branch: rebuild/v2. Production main remains the legacy v1.14 app.

## Status

G1 foundation and G2 transactional session engine exist. **No game is playable yet.**
The German preview UI has Spielen, Inhalte, Verlauf and a static Beamer waiting screen.

## Architecture

- React 19, TypeScript strict, Vite.
- Pure typed domain reducers and five game type registrations.
- Native IndexedDB storage (versioned v2 namespace), validated command envelopes, immutable receipts and audit ledger.
- Scores derived from score outcome records, including explicit audited void/restore.
- Persistent host epoch, revision guard, explicit takeover and safe checkpoint recovery.
- Public-only stage DTO generated after commit; live synchronization will be built in G3.

## Run locally

Node.js 22.12+ and npm 11:

    npm ci
    npm run dev
    npm run verify
    npm run build

CI runs exact locked dependencies, strict typing, lint, tests and build.

## Safety

Do not merge rebuild/v2 into main or use the production GitHub Pages domain for previews.
Do not read or modify browser storage from the old app (ligo.quiz.*).
No PWA/service worker, backend, accounts, AI API or production migration is installed in G2.

Next: G3 host/projector transport and connection-state recovery.
