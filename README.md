# LiGoQuiz 2.0 — G1 engineering foundation

Branch: rebuild/v2. Production GitHub Pages remains on main (legacy v1.14).

G1 is deliberately **not playable**. It provides:
- React + strict TypeScript + Vite static app shell, German navigation and projector preview.
- Separate domain contracts and five game registry entries (all not ready).
- Exact BP-03 event-placement scoring including ties.
- A strict public stage-data projection with privacy tests.
- Vitest regression suite and GitHub Actions check/build.
- No PWA, gameplay, account system, backend, migration or deployment.

## Local development
Node.js 22.12+ and npm required.

    npm ci
    npm run dev
    npm run verify
    npm run build

The first successful rebuild-branch CI run will commit a dependency lockfile.
After that, npm ci is required.

Routes: #/spielen, #/inhalte, #/verlauf and #/stage.
The Beamer route is a waiting preview, not real synchronization.

Do not deploy this branch to the production Pages site. The G1 work
does not read or write legacy browser keys. A separate URL path is NOT
a separate browser origin; use a different origin for future previews.

G2: transactional engine, indexed storage, fencing and recovery.
G3: host/projector protocol.
BP-03 game rules and BP-04 visual concepts still need owner approval.
