# U02 — Studio Pop real app navigation shell

## Scope

This phase migrates the **real organizer shell** from the old permanent SaaS sidebar to three role-based spaces using the existing U01 Studio Pop design system. It does not redesign game cards, setup forms, host game interfaces or the public projector; those belong to U03–U09.

- Spielwelt — original `#/spielen`, `#/setup`, `#/demo`.
- Spielleitung — original `#/host`, existing host identity and data-controller paths; original `exp-host-header` preserved.
- Backstage — original `#/inhalte`, `#/verlauf`, `#/bericht?event=…`, `#/technik`, `#/einstellungen`. The settings route retains existing local backup/recovery. G26 preflight remains inside Technik, unchanged.
- Public projector — original `#/stage?event=…`, **no organizer shell at all**, same `StageView` and publish-only allowlist.

No route names or hashes were changed. Backstage landing uses the existing `#/inhalte` route, not a fake new route or redirect. Reports are highlighted as Verlauf via `backstageActiveRoute`.

## Files

- `src/app/shell-model.ts`: pure, unit-tested route→zone, nav groups, contextual shortcuts, headings.
- `src/app/AppShell.tsx`: scoped nav, region banner, contextual links, backstage subnavigation, accessible mobile menu.
- `src/app/app-shell.css`: horizontal desktop header; mobile disclosure navigation; carefully scoped legacy workspace bridge; no global StageView styles.
- `src/app/App.tsx`: replace only outer routing chrome, keep existing surface branches unchanged.
- `tests/u02-shell.test.ts` and `e2e/u02-shell.spec.mjs`: cheap focused route/DOM evidence.

## Safety and visual boundary

1. The UI displays no fabricated live status. `#/host` still resolves through `readHostIdentity` and existing EventRepository. The Beamer status and private content remain under the existing host publisher, not shared navigation.
2. No writes to old or new storage schemes, game domain, public projection, service worker, content-editor provenance, migrations or release gates.
3. Existing `exp-page`, `exp-form`, `exp-host-wrapper` and other internal surfaces remain usable in a pale reading workspace until their later design phases.
4. Mobile menu is a native `details/summary` disclosure keyed to the route to close after navigation; keyboard and reduced-motion preferences work without a new persistence layer.
5. The original `#/stage` returns before the new shell mounts. G15 projection CSS unchanged. `#/demo` remains its explicitly disposable focused view.
6. The U02 shell is a navigation architecture milestone, not a production release. All G26 NO_GO criteria remain.

## Next

**U03** designs the real home and game chooser using the five existing U01 game identities, while retaining the now-shared U02 navigation.
