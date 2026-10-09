# G11 — Production Resilience, Isolation and Device Qualification

Stacked on **G10 PR #8**, branch `feature/g11-production-resilience`; production `main` untouched.

## Implemented

1. Offline shell built from actual hashed Vite assets with `sw.js` generated during production build; scoped to the deployed origin/path. Never registers under Vite development. The SW precaches `index.html` and CSS/JS bundles in a versioned cache; navigation serves the cached shell if network fails. No cross-origin caching, no interception of IndexedDB or legacy localStorage.
2. **Conservative updates**: no `skipWaiting` in the installation path, no automatic live reload, no `clients.claim()`. The only activation message is behind a direct organizer action and a preflight that refuses update if any locally saved session is active, paused, recovery-blocked, or invalid. Manual review of other open tabs and physical devices remains mandatory.
3. Manifest and SVG app identity with relative `./` path/scope; secure-origin checks.
4. Organizer **Technikcheck** now shows HTTPS readiness, IndexedDB write probe in an isolated throwaway database, offline cache and controller, storage persistence status and advisory quota, update waiting status. It intentionally warns when no offline control is available.
5. Settings backup desk exports **full event + outcomes + audit + checkpoint** from one consistent IDB transaction, with SHA-256 checksum. Restores reject tampering and ID collisions, atomically restore historic ledger records, rotate host ID and epoch, invalidate old command receipts, pause live games, and require host review. Finished history stays finished. No destructive overwrite or automatic old-session resume.
6. Vitest regressions for checksum, incomplete/foreign histories, score evidence and host fencing; Chromium widths (390/768/1280), keyboard/preflight, reduced motion, 200% document text, pause state. **Independent built-PWA offline Chromium tests** are run on Vite preview, not only development server.

## Explicit release boundaries

- The backup is **per-session**, not a replacement for the separate G10 content-library export or v1 legacy browser-profile export. Complete backup strategy requires three separate downloads where relevant.
- SW caches only shipped shell assets; it does not sync scores between different devices and must not cache private API responses. Inadequate storage quota remains user/operator concern; persisted() provides advisory only.
- An installed PWA and passing headless Chromium test cannot certify iOS/Android PWA installability, physical 1280×720 projector output, audio/AV switching, room brightness, full WCAG audit, real offline power-loss behavior, or multi-device migration.
- Owner must perform physical projector + laptop rehearsal and an actual offline restart after setup. Organizer should exit all open client windows and confirm no active sessions before activating a waiting SW.
- All human G8–G10 editorial approvals remain pending. No merging/deployment without G11 exact-head CI and human acceptance. G12 requires structured 3/4/5-team dress rehearsals, G13 handles reversible cutover.
