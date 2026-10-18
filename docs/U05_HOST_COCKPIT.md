# U05 — Studio Pop universal private host cockpit

The real #/host route wraps the five original host components in a reusable, strictly read-only cockpit. This is only U05; public StageView and game-specific U07–U09 presentation remain unchanged.

## Source of truth
- host-cockpit-model.ts derives current phase, paused/recovery, progress and team scores from the canonical EventRecord and each original game's scores() function. No new writer, timer, scoreboard store, game command or fabricated connected-projector status.
- App.tsx checks original host ID ownership before mounting any host UI, then refreshes read-only snapshots every 2.5 seconds. On missing/corrupt/unauthorized event, the private cockpit and original host both unmount; no stale results are shown.
- The five authoritative hosts retain their original commands, projector publisher, stage transport, scoring, timer, error recovery and revision/CAS protection.
- HostCockpit.tsx renders Studio Pop game identity, original team/score readout, game-progress, current moderation guidance, private-context labels and simple shortcuts. No unpublished answer text or moderator notes are read.

## Navigation and safety
- The stage shortcut uses the existing stageUrl(event.id) with target blank and noopener/noreferrer, opening the public-only #/stage renderer. Merely opening it does not publish data or claim a connected projector.
- The original host UI remains the only place to publish, pause, resume, score, reveal, perform corrections and approve rights. The main action simply scrolls to its original controls.
- Existing routes, storage, offline shell, local data, release NO_GO, G26 source/physical approvals and projector separation untouched.
- CSS is scoped to .sp-cockpit and the organizer's Spielleitung zone; no global StageView selectors changed.

## Verification
Dedicated Chromium U05 runs through actual U04->host, authentic scores and native control, safe stage link, bad host ownership and mobile layout. Original G4 Chromium suites, TypeScript, ESLint, Vitest, production/offline PWA builds and regressions must pass. Physical venue and full U01–U10 release qualification deferred.

The control-focus shortcut is a button focusing the existing host area (not an invalid hash anchor that would trigger router navigation).
