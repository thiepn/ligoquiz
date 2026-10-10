# G21 — Independent Trust-Root Attestation & Multi-Party Release Dry Run

## Authoritative predecessor and exact scope
G21 branches **directly** from G20's qualified draft PR #18, commit `f066894f11dd96432bfb73e242b97aaf72cc4655`, not from main. G20 source qualification: Verify 38068661111 (190 unit tests), G4 Chromium 38068661146 (72 Chromium / seven offline tests), successful exact-head builds and retained source and visual artifacts. G12–G20 drafts remain unmerged; inherited real-world release and accessibility evidence gaps are still OPEN.

## Actual non-deploying features
- Adds a separate German **Unabhängige Root-Attestierung** panel to Technikcheck after G20, with strict G18 original JSON, local SHA-256 verification of the G20 NO_GO handoff, source-specific import of independently signed G21 detached Ed25519 statements and separately received **public-only** keys. Optional original binary evidence is compared in-memory, never persisted/transmitted or included in exports; files capped at 12 MiB and JSON at 256 KiB.
- G20 exported handoff includes hashes but **not original Ed25519 signature envelopes**. G21 correctly labels the G20 parent *unanchored* and *original signatures not reverified*. Recomputing its SHA-256 does **not** authenticate authorship or rights. To reach an actual external root gate, authorized parties must re-obtain and independently verify unmodified G20 original signed statements and credentials off-platform. No counterfeit trust roots are minted.
- Enforces exact G18/G20 source and G20 qualified head, original 15-scenario key/role contract, detached signature/public-key hash, strictly ordered single-case immutable hash chain, chronology, replay/gaps/forks, custody/cross-review/owner credential separation, two distinct proposed PIN witnesses, constrained rotation references, revoked/compromised root/signer fencing and incident conflict detection. Rights, real devices, venue and disposable recovery receipt actions require actual matching binary bytes.
- Exports separate **G21 NO_GO release dry-run** checksum packet; this is a cross-checkable *report*, not an approval. Six gates are visibly OPEN or UNBESTÄTIGT. Independently anchored real-world identities remain zero; owner authority, rights, physical tests, real restore and all production merges/deploys stay false.
- Adds adversarial synthetic-only unit and real Chromium tests (including forged signatures, parent mismatch, replay, contradictory actors, forged original bytes, incident fencing, keyboard/200%-zoom) plus a new test-first G21 browser job and retained visual evidence. Existing G12–G20 screenshot goldens, scoring logic, source licenses and genuine production workflows are not modified.

## External qualification that cannot be simulated
1. Independent off-app custodian/reviewer legal identity and public-key trust root PIN/ROTATE/REVOKE/COMPROMISE original-signer verification.
2. Independent source object/original-byte/rights/license/copyright adjudication, by authorized human.
3. Authorized disposable backup restore and prior-stable recovery with original bytes and independent observer (no production overwrite).
4. Physical projector from audience sightline, Android/iOS, 200% zoom, physical keyboards and TalkBack/VoiceOver acceptance with genuine witness artifacts.
5. Separate independent owner decisions for staging, release, merge, deployment, public publication, and post-release rollback. No auto-approval.

### Release status
**NO_GO.** Draft PR only; branch stacked from G20. No live recovery, merge, deployment, content publication, migration, or golden modification. Synthetic signing keys and browser emulations are *only* code tests; they never qualify off-device trust or human decisions.

## Next G22 — Independent Physical Acceptance & Original-Custody Reconciliation
Not started. Focus on independently reviewed physical-device evidence and original-source provenance without storing confidential originals, multi-operator incident resolution and prior-stable restore custody, with separate owner-controlled staging/release/postrelease decisions. First require green G21 exact-head jobs/artifacts; retain NO_GO until actual human approvals.
