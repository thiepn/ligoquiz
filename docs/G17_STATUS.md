# G17 — Source-safe correction provenance and independently reconcilable local evidence

Stacked separately on qualified G16 PR #14 at `da62497165da5182191538538c1717a763e4dcdc`.

## User-visible source work

- All five live hosts show a read-only revision-aware action history from their actual saved game audits and the event's frozen-content source-fingerprint presence. The last twelve actions include revision and human-readable action category, including audited corrections and score confirmations; private answers, raw response text, host keys and command IDs are never shown.
- Audit anomalies in revision ordering, repeated command IDs, host epochs, and revision/state mismatch are flagged instead of passing as credible history. This display is *not* an independent proof of rights or approval and never replays or mutates an action.
- Error UI now explains stale revisions, revoked host ownership, recovery and unknown failures with a fail-closed next step. Only an explicit confirmation on the operator's button can reload the page. Revoked ownership has no retry control and is never bypassed; a page reload does not resubmit the previous command.
- Existing G16 evidence notes can now be independently reimported as a bounded, local self-consistency envelope. Checks exact 15 filename/game/SHA256 pins from G15, all denial flags, totals and SHA-256 over the unmodified canonical packet. Tampering, missing entries, forged approvals or unknown sources are rejected. **The SHA-256 is self-consistency, not a digital signature or an authenticated third-party witness.** No credentials/identity are invented; there is no network upload or persistence.
- Full system retains G16 scorer-backed previews, G15 real Chromium projection geometry, G14 accessible keyboard focus, and existing engine adjudication, ownership fencing and source provenance.

## Qualification
Check exact final head on Verify v2 and G4 Chromium + offline PWA, G17 adversarial unit tests, five real-host browser audit/disclosure tests, evidence export/import tampering, 1280×720 projector, 200% zoom, privacy and all G12 crash/score/backup regressions.

Human physical-device/projector/accessibility/rights release approvals remain **OPEN**. No merge/deploy, migrations, original screenshot changes, fake signoffs or status baselines changed.

## Next G18 — Human Event Trial & Independent Release Gate Matrix
**Status: NOT STARTED.** Run a comprehensive operator-facing full game-night rehearsal checklist, authorized real projector/accessible device witness packet preparation, reproducible correction/backup return-path checks and independent go/no-go reconciliation. Do not claim actual device or human approval until obtained. Do not merge/deploy.
