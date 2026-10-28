# G27 — Source-context-safe multi-visit content review

## Reproduced source defects
The old G10 CSV reader compared ten original source columns instead of fourteen. Source-route, research guidance, G23 issue warnings and related-question conflicts were ignored; consequently an unchanged draft could incorrectly retain a CURRENT reviewer note after new duplicate issues. G23 detected duplicates only on later-loaded items, making that mismatch asymmetric.

## Implementation
- Check all fourteen original source/context columns and name changed fields in reviewer notes.
- Return reciprocal exact/possible-duplicate warnings, keeping manual editorial decision authoritative.
- Add deliberately triggered local re-export carrying reviewer notes ONLY for matching original question/source/context; changed or missing notes remain in the original uploaded CSV but cannot be silently moved onto another revision.
- Reuse the original G10 editor, four-check review, current question and CAS, original source IDs, five game engines, projector allowlist, event scoring, local backups and offline PWA.

## Acceptance boundary
Added adversarial unit tests for newly arising conflicts, multiple source revisions, missing notes and forged CSV; genuine browser test covers original import, note export, draft revision and old note refusal. Human source rights, original 704-item migration, physical hardware/venue and explicit owner authorization remain NOT_TESTED / G26 NO_GO. No merge, migration, deploy, publication or production writes.
