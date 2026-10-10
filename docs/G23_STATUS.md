# G23 — Source Rights & Approved Content Reconciliation

## Original v1.14 source inspected
Original production `main/index.html` is an approximately 1.43-million-character, single-file source at Git blob SHA `0dc9c86abd4bda3b67fb7f4774429ba04578c76f`; it was read from the **original GitHub blob**, not inferred from documentation or a simulated browser database.

The embedded **v1.13** `CONTENT113_META` claims 706 total, 704 active, 556 approved, 148 edited, and 2 rejected, with eight active families: `cb:300 rs:192 cl:48 cs:38 cw:20 lg:54 svg:39 svl:13` (sum 704). Independent parsing of first-party JavaScript-embedded JSON found 366 keys in `CURATED122_BASELINE.reviews`, 340 entries in `CONTENT113_ADDITIONS` and 340 entries in `CONTENT113_REVIEWS` (all marked approved at that version). Addition family counts: `cb:150 rs:100 cl:20 cs:15 cw:10 lg:25 svg:15 svl:5`. This independently supports **declared metadata inventory arithmetic** (366+340=706, minus two rejected=704) but **not** substantive facts, externally verified source rights, 704 complete active-question extraction, absence of contradictions, or v2 playability.

The original v1 source and baseline/additions are not re-published/copied into the v2 code. Existing eight v1 families do not automatically map onto the five typed G10 v2 game payload schemas. G10 `previewFile` supports format `ligo-content-pack`, v2-content v1 and prefix-scoped `ligo-legacy-export`; it only converts valid structurally typed records and quarantines unknown families. Original hard-coded embedded v1 data in `index.html` are **not** automatically extracted from browser localStorage. Do not label this a complete 704-item migration.

### G23 product changes
- Human-readable original-code **metadata comparison** versus the **actual** content currently loaded from `ligoquiz.v2.content.g10` IndexedDB; per-v2-game inventory, drafts, G10-local approval claims and separate source/review issues.
- Pure read-only editorial scan across all five G10 schemas: invalid payload, unchanged placeholders, imprecise/missing citations, answer-as-reference, missing rights documentation, illustrative survey claims, missing imported bundle hash, inherited locally-approved status without independent verification, exact/near duplicate prompts.
- Accessible per-issue selection, blocker-only filter, independent original source-family legend. The source legend explicitly distinguishes 706/704 **declared legacy metadata** from currently loaded v2 data.
- Human-editor provenance field for original rights/license notes. The existing `ContentRepository.saveDraft` revision fence saves provenance changes with the selected question and **resets local approval**. Self-entered text does **not** verify ownership or permission.
- Data-minimizing JSON issue index with item ID, game, code and severity only, never actual copyrighted prompts, answers, imported raw quarantined data or original bytes. The export always denies independent rights/fact certification and publication/merge/deploy authorization. Imported previews remain uncommitted, existing G10 review/approval workflow still requires the four human checks.

### Deliberate exclusions and blockers
- No bulk copy or automatic promotion of all 704 source items; no invented reviewer decisions, new academic or biblical assertions, copyright licenses, publisher permissions or source-specific accuracies.
- Automated audit flags are **triage** and do not by themselves decide correct answers, theological interpretation, or nuanced licensing. Errors and false positives require human adjudication.
- G10 existing approved packs remain unchanged; independent approval is a distinct unresolved release gate.
- Original v1 main, existing stacked PRs, screenshot goldens, scores, v2 game/session engines, existing host/private projector and original deployed-origin storage are unchanged.
- No merge, deploy, migration, stage, release, or postrelease acceptance without owner authorization. NO_GO remains enforced.

### Real acceptance contract
1. Export the original protected v1 asset and a checksum-bound, read-only inventory from each authorized original origin; retain original 1.14 HTML and all corresponding browser profiles with their source hashes and provenance.
2. Independent editor individually reviews original question, accepted answers, difficulty, ambiguity, biblical/factual citations, image/translation rights, category/5-game mapping and sample-user fairness; explicit rights/license evidence is recorded off-platform.
3. Import *only* reviewed, format-correct v2 drafts; check source bundle receipts/quarantine/duplication and 3/4/5-team game pack completeness, compare manually with the source ledger, record actual missing families.
4. Only independently authorized editor releases content; owner separately decides staging/release. Devices, projector, accessibility, restore and custody remain external NO_GO gates.

### Next G24 (proposed, NOT STARTED)
**Actual game-night acceptance pilot and experience hardening**: owner-guided 15-case venue rehearsals, original-device accessibility, observed player/operator defects, current content choice, rollback and late-stage release-readiness integration; repair observed source defects only. No automatic deployment.
