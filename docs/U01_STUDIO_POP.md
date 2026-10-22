# U01 — Studio Pop visual foundation (LiGoQuiz 3.0)

## Scope and preview

A reusable, **display-only** design system, independent of game scoring and publication. This is phase 1/10 only. No app-shell redesign, host migration, projector layout replacement, release or deployment.

In an existing executable V2 checkout: `npm run dev`, then open **http://127.0.0.1:5173/studio-pop.html**. This is an isolated **Vite development preview**, not a route in the production app, a broadcast channel, or a game session. It uses illustrative text, mock scores and local preview state only. Vite's standard single-page production build continues to use `index.html`.

## Visual identity

- Theme: **Studio Pop** — vivid game-show blocks, rich midnight backdrop, bright yellow showtime affordances, crisp angular motifs, poster-scale display typography.
- Colors (CSS in `src/design-system/studio-pop.css`):
  - Ink `#101629`, midnight `#151F3C`, raised `#263959`, paper `#F7F7FE`.
  - Show yellow `#FFE45C` always with dark text.
  - Mode colors for **white** legible text: blue `#285BFF`, pink `#DA2C70`, mint `#00786A`, violet `#713FD2`, orange `#A34C00`.
  - The lighter decorative coral and amber may appear in artwork only, **not** as backgrounds for small white text.
- Approximate WCAG contrast against white: blue 5.21, pink 4.59, mint 5.39, violet 6.28, orange 5.85. Dark text on yellow exceeds 14. These are calculated token pairs, **not** a claim that every future composition has passed accessibility review.
- Font stack: offline platform-installed Arial Black / Trebuchet MS / system fallbacks. No network font loading, license uncertainty or run-time CDN requirement.
- Visual shapes: locally rendered inline SVG (logo and five game motifs) and CSS geometry, with no remote or copyrighted media.
- Motion: entrance effect and interaction feedback defined once, disabled by `prefers-reduced-motion`; no auto-playing audio or countdown.
- Interface language: German with short show-style labels; preserve authoritative game wording from game content.

## Implemented reusable primitives

| File | Export | Intended later use |
| --- | --- | --- |
| `theme.ts` | `GAME_VISUALS`, `GAME_ORDER`, `TeamTone` | Five consistent mode identities |
| `StudioPop.tsx` | `StudioPopLogo`, `StudioPopMotif` | Brand and decorative non-interactive game motifs |
| same | `PopButton`, `PopTag`, `PopPanel` | Controls, state badges, structural surfaces |
| same | `GameTile` | Lobby/game chooser in U03–U04 (no fake links in U01) |
| same | `TeamBadge`, `ScoreChip` | Team and published-score visual projections |
| same | `PopTimer`, `PopProgress` | Read-only timer and progress components; no timing engine |
| same | `PopShowFrame` | Decorative stage/host visual shell (no channel or data access) |
| `StudioPopPreview.tsx` | `StudioPopPreview` | Isolated interactive visual specimen, desktop/mobile examples |

The components have no imports from `EventRepository`, host controllers, stage publisher/viewer, answer store or recovery controls. Components receive display props only. The preview's buttons alter example state only.

## Boundaries for U02–U10

1. Apply these tokens and primitives to real screens **incrementally**, starting U02. Do not dump the scoped preview CSS into the existing global CSS.
2. Every real action must be wired to its original authoritative workflow; no demo-only buttons in production.
3. Preserve original event IDs, host-ownership gates, private answers, published-scene allowlisting, atomic scoring, score correction reasons, offline local storage, backup/recovery and content provenance.
4. Maintain G15 original locked screenshot evidence. New show visuals will require **new versioned** screenshot baselines after the UI phases.
5. Keep all pre-existing release NO_GO conditions, physical projector/a11y and owner acceptance gates intact. No merging or deployment here.

## U01 evidence and deferred qualification

- Source surfaces before U01: `src/app/App.tsx`, `src/main.tsx`, `src/styles/base.css`, `src/styles/g15-projection.css`, `src/features/stage/StageView.tsx`, existing five host views, `src/features/experience/SetupWizard.tsx` / `Sessions.tsx`, `src/features/content/ContentStudio.tsx`, `vite.config.ts`.
- U01 intentionally leaves all original files and tests unchanged.
- Run lightweight TypeScript, Vite and an isolated visual preview review. Comprehensive browser coverage, projector acceptance, real device testing, offline regressions and all release qualification are deferred until U10 concludes.
