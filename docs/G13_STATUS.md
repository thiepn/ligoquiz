# G13 — Session Discovery, Shareable Results & Printable Standings

**Branch:** stacked draft on G12 PR #10 at `07fd07e3ff2c5bce9fd62e7345a88e0472c0439f`. No merge/deploy.

## Product improvements
- Remove the seven-session cap. Search every unfinished session by game, status, profile or team name, with result counts and an empty state.
- Completed history is searchable by game and team without consulting private answer material.
- Completed game reports offer German Excel-ready CSV: semicolon-delimited, UTF-8 BOM, comma decimals, tied ranks and half points, formula-injection protection and visible content-source provenance. Existing JSON export remains.
- Native print/Save as PDF formats A4 results while hiding the sidebar and controls.
- Add unit/privacy/CSV regressions and a real-browser saved-session search test.

G13 changes no game engine, score transaction, content approval, projector privacy protocol, or production data. These are completed-result summaries, not recoverable session backups. All G12 physical and human acceptance gates stay open.

**Next:** G14 — Faster Game Moderation & Keyboard Accessibility: clearer in-game primary actions, explicit dangerous action confirmations, keyboard and 200% zoom validation across five games. Not started.
