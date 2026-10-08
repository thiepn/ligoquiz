# G3 — Host / Projector Synchronization

Date: 2026-10-08
Branch: `rebuild/v2`. This is not a production release.

## Implemented

- Per-event `BroadcastChannel` identified by `ligoquiz.v2.public-stage.<eventId>`.
- Strict, versioned Zod protocol: `HELLO` (projector → host), `FRAME` (host → projector), `ACK` (projector → host).
- Only validated `PublicStageDto` frames go onto the channel. No session aggregates, host commands, answer keys, unpublished clues, moderator notes, local database contents, or authority credentials.
- Host publisher reloads *committed* event state from IndexedDB, checks `hostId`, and derives a safe frame. Messages are never generated directly from pre-commit UI state.
- Periodic host refresh (1.6 seconds in the G3 technical console); public retransmission serves as heartbeat.
- Projector initial handshake, late joining, reconnect requests, stale/expired frame blanking (5.5 seconds by default), and host-epoch plus stage-revision monotonic ordering.
- Same-version contradictory frames fail closed until a newer version arrives.
- Viewers acknowledge valid frames; host reports currently acknowledged same-origin projector windows with expiry rather than assuming all opened windows are connected.
- Separate audience-only React surface at `#/stage?event=<id>`, displaying waiting, pause, question, published clues, revealed answer, and score scene DTOs. This view does **not** open IndexedDB, import the host controller, or read browser storage.
- Host-side **G3 Techniktest** in Spielen creates only an isolated demonstrator session with three anonymous teams and one intentionally fabricated sample question. Enables ordered start/question/hint/solution/advance and pause/resume, separate audience window and explicit reset.
- Client navigation guards against painting a previous event's stage scene while switching URLs. `rel=noopener noreferrer` prevents opener access in the audience tab.
- `main`, Pages, DNS and existing legacy `ligo.quiz.*` storage untouched.

## Rehearsal steps (run from isolated localhost, not production)

1. `npm ci && npm run dev`.
2. Open `#/spielen` and find **G3 · FUNKTIONSTEST**.
3. Choose **Techniktest anlegen**, then open **Beamer-Fenster öffnen** (second tab/window).
4. Verify host reports an *acknowledged* projector and the stage shows the safe waiting scene.
5. Start the demo, publish the sample question and its hint, then reveal the answer. Verify the answer did not appear before explicit reveal.
6. Pause/resume, reload the projector, and confirm public scene reconnects without consulting session storage.
7. Close the host window; after the heartbeat timeout the audience stage must blank to a waiting/connection-loss state.
8. Resume using the same host tab, or create **Anderen Techniktest beginnen** for a new session. Corrupt session recovery and multi-host handover UI remain later work.

## Tests

- `g3-stage-viewer.test.ts`: malformed messages, wrong session, handshake and acknowledgment, timeout/renewal, out-of-order frames/epochs, contradictory same-version frames, route validation.
- `g3-host-stage.test.ts`: fake-IndexedDB committed state and independent channel ports, late joining, explicit solution publication privacy, old-host takeover fencing, stale audience count.
- `g3-broadcast.test.ts`: native BroadcastChannel across separate ports, real protocol acknowledgments and public snapshot validation.
- Existing G1/G2 tests remain intact. The acceptance requirement is a green `npm run verify && npm run build` in GitHub Actions on the final G3 commit.

## Explicit limits

- BroadcastChannel works across same-origin browsing contexts in the same storage partition, generally on one device. It is not a remote cross-device synchronization API.
- BroadcastChannel is **not an authentication boundary** against other malicious same-origin JavaScript. The privacy guarantee here is architectural minimization of legitimate public payloads, not protection against a compromised origin.
- Host/authority fencing remains backed by G2 IndexedDB. G3 does not provide a general moderator interface, production game mode, user accounts or remote access.
- Browser hardware/real-projector usability and resilience across different browsers or computers are not qualified by automated Node tests; G12 conducts physical rehearsal.
- No offline install/service worker is registered in this phase.
- Future G4–G9 game engines will replace the one-question demo with validated live-game content and host controls; do not present the demo as complete gameplay.

## Exit checklist

- Strict schema checks reject private fields and wrong protocol versions.
- Expired/stale stage must blank instead of freezing an old answer.
- Host may publish only from committed, authoritative state.
- Late joiners receive the latest valid public frame.
- Commands/authority stay in G2; projector has no access to host commands.
- GitHub CI must be green on final SHA.
- Production main is unchanged.
