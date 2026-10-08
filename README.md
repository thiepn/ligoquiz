# LiGoQuiz 2.0 — Modular Rebuild

Work branch: `rebuild/v2`. The live GitHub Pages production site still runs legacy v1.14 on `main`.

## Current implementation status

- **G1:** Modular React + strict TypeScript + Vite foundation; three German navigation destinations.
- **G2:** IndexedDB transactional host command engine, authoritative revisions, score ledger, recovery, and typed public DTOs.
- **G3:** Separate host/projector BroadcastChannel handshake, public-only frames, ordering, disconnection blanking, recovery requests, acknowledgment, and a *technical rehearsal*.

**The five real games are not playable yet.** The G3 demo is one synthetic question used to test the projector and transaction path, not a complete quiz.

## Local run

Node.js 22.12+ and npm 11:

```sh
npm ci
npm run dev
npm run verify
npm run build
```

Navigate to **Spielen → G3 Techniktest → Techniktest anlegen**. Open **Beamer-Fenster öffnen** in a separate window on the same origin. Use the explicit host buttons to demonstrate public prompt, hint, and intentional answer reveal. Disconnect the host to verify safe viewer expiration. See [G3 operational specification](docs/G3_STATUS.md).

## Architecture

```text
src/
  app/                    React shell and routing
  application/            Host controller (post-commit only)
  domain/                 Pure event/scoring/projection contracts
  features/host/          G3 rehearsal control surface
  features/stage/         Public transport, presenter and stage UI
  games/                  Future game-specific modules
  infrastructure/db/      Atomic IndexedDB event store
  styles/
tests/                    Vitest domain, database and transport tests
```

- Projector windows receive only allowlisted public DTOs; they do not read the event database.
- The host publisher validates its authority from committed storage before each retransmission.
- `BroadcastChannel` is same-origin and same-storage-partition only, generally same device. It does **not** implement cross-device sync or authentication.
- The original app's `ligo.quiz.*` localStorage remains untouched.
- No v2.0 service worker or PWA installation has been deployed.

## Next

G4 starts the first actual playable Rundenquiz and the host preparation flow. Additional games, content migration, offline qualification and production rollout remain separate gates. Never merge unfinished v2 code into `main`.
