# U04 — Real Studio Pop setup and safe pre-show

The original three-step #/setup wizard is visually redesigned without replacing its business actions, storage, permissions, game engines or stage publisher.

* Teams: 3–5 original teams, unchanged 40-character field limit and case-insensitive unique name validation, locally saved drafts. Numbered responsive roster adds inline invalid-state semantics.
* Program: five U01 visuals and motifs in original game selector with aria-pressed state; original profile quantities, original trial / editorial-approved radio choices and rights warning. Changing controls edits only the existing draft.
* Ready: original exp-summary, original explicit projector/mirroring acknowledgement and existing prepare() function unchanged. It creates a real event only after acknowledgement and hands off to the original private host route.
* Side preview: locally derived and marked NOT LIVE. No fake status or projector scene.
* Distinct responsive desktop, tablet and 375px mobile, keyboard-visible focus and reduced-motion preference, offline-safe SVG/system fonts.

Kept original headings, form labels, original buttons, selectors, event IDs, IndexedDB data, original localStorage schema, consent and G26 NO_GO. No added dependency. Dedicated Chromium exercises game choice through reload, fail-closed validation/acknowledgement, mobile layout. Original G5/G23 acceptance still applies. Qualification after U10.

## Mobile Chromium layout correction

Exact-head browser run #39166146949 passed 96 tests but revealed real 375px horizontal overflow on the Program step. The shared old .exp-choice-games .exp-program flex rule could override the U04 card grid at equal specificity, producing minimum-content overflow. Add a specifically scoped grid override and shrink-safe columns, text and content-source fieldset sizing instead of masking scroll overflow. Keep the 375px Playwright assertion unchanged; subsequent CI determines acceptance.

## Chromium follow-up

Run #39166808003 still shows a genuine program-step 375px horizontal overflow (96 other browser tests pass). Strengthening card grid specificity alone did not resolve it. Preserve the assertion while adding client-geometry diagnostics to identify the actual overflowing element before applying any further CSS patch.

## Root cause and scoped fix

Run #39167482028 geometry diagnosed 391px document width at a 375px viewport: five SVG motifs each had a bounding rectangle starting x=332 and ending x=391. U01's global Studio Pop .sp-motif assumes absolute positioning for its full-size GameTile. U04 placed those motifs inside smaller game card icon boxes without resetting position. U04-only selectors now restore static in-flow SVG positioning and remove inherited right/top offsets/rotation for game-selection and side-preview art. Original five-game lobby decorative motifs and public projector remain untouched; maintain real overflow check.
