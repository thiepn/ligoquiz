# U11 — Compact private host view

The existing `#/host` cockpit placed a full-width game banner, three readouts and large score cards before the native host. At mobile widths this required scrolling well past the summary to reach real round controls.

The in-place **Kompaktansicht** toggle reduces the banner, progress, score cards and shortcuts while preserving live original-score and original-phase readouts, source-of-truth privacy notices, recovery warnings, game mode and the original game host below. It is off by default and uses an accessible pressed state. The preference exists only in the current React instance: no persistence, new domain author, timer, grader, store, host identity or stage transport.

The public stage, G15 screenshot baselines, all five game engines, original session data and safety/owner/rights boundaries are untouched. Opening the stage continues to be a separate intentional action, not evidence of a connected projector.

Browser regression `e2e/u11-host-density.spec.mjs` covers real prepare→host flow, in-place compact and expanded views, original game command access, projector link isolation and 375px viewport integrity for all five game modes. Full TypeScript/Vitest/Vite/Chromium and installed offline-PWA qualification remains required; release is still NO_GO without real owner/physical/editorial acceptance.
