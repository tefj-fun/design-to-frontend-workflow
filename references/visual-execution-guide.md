# Visual Execution Guide

Load this reference when the entrypoint is not enough. It expands the operational details for converting screenshots, Figma/mockup references, and visual UI targets into maintainable frontend code.

## Source Handoff

Rank source material in this order: Figma file, Figma frame or structured spec, high-resolution screenshot/generated mockup, low-resolution rough image. If only an image exists, create a handoff before coding:

- Component inventory: screens, panels, cards, controls, maps, tables, modals, overlays.
- Text inventory: headings, labels, values, buttons, empty/loading/error states.
- Token inventory: colors, typography scale, spacing, radii, borders, shadows, focus rings.
- Asset inventory: icons, logos, photos, maps, charts, avatars, screenshots, generated illustrations.
- Responsive targets: desktop, tablet, mobile widths.
- Known uncertainty: inferred text, hidden states, unavailable assets, unknown interactions.

## Component, Mask, Asset, And Icon Manifests

Create a component-region manifest for high-signal repeated units: primary buttons, form controls, tabs, nav items, cards, table rows, badges, icons with labels, modals, list rows, and toolbar actions. Record id, selector or owner text, expected bounding box, crop padding, component state, viewport, and which text/icons/overlays are scored. Prefer source-derived boxes from Figma, benchmark DOM, or rendered element bounding boxes. If boxes are inferred from a screenshot, label them inferred and verify visually.

Use `scripts/visual_region_manifest.js --target <page> --source region-source.json --output regions.json` when regions can be identified by selector or visible text. Pass `--region-manifest regions.json` to `scripts/visual_compare.js`.

Create a mask manifest only for inherently raster or externally rendered regions: photos, video thumbnails, maps, satellite tiles, charts, canvas/WebGL, screenshots inside the UI, avatars, generated illustrations, ads, QR/barcode-like images. Do not mask normal UI primitives, icons, text, buttons, form controls, cards, borders, shadows, or layout containers. If raster regions contain overlay UI, mask only the image pixels and keep overlays scored whenever practical.

Before spending implementation time on image-like regions, choose an asset policy:

- `exact-required`: acquire/export/source the asset before tuning layout.
- `representative-accepted`: mask raster pixels but verify geometry and overlays.
- `generated-replacement`: generate or source a closer asset, then freeze it as a fixture.
- `blocked`: document the blocker instead of burning cycles on code-drawn substitutes.

Build an icon manifest before coding. List every visible icon by semantic role, region, owner text or component, approximate size, stroke/fill, color, and state. For repeated cards, rows, or metadata lines, audit icons per item. Prefer existing repo icons or proven libraries such as Lucide, Heroicons, or Material Symbols when shapes match. If no matching icon exists, create a small semantic inline SVG component. Do not omit ambiguous icons; mark uncertainty and create the closest scoped placeholder.

## Design-System Census

Before page lock on multi-screen work, inspect all provided pages once and extract:

- Shared shell and layout: app frame, navigation, headers, sidebars, grid columns, gutters, panels, breakpoints.
- Tokens: color roles, type scale, line heights, spacing units, radii, borders, shadows, elevation, focus rings, disabled/selected states.
- Shared components: buttons, inputs, selects, tabs, cards, badges, tables, list rows, modals, toasts, filters, search, pagination, loading/empty/error states.
- Shared icon language: library/source, stroke width, fill mode, semantic roles, icon-label patterns.
- Page templates: dashboard, list/detail, map/list, wizard/onboarding, settings, analytics, table-heavy, card grid, modal workflows.
- Raster policy: photos, maps, charts, avatars, screenshots, generated illustrations, exact versus representative content.
- Exceptions: similar-looking elements that must remain separate because behavior, state model, or data contract differs.

Use the census to define stable primitives. Add shared primitives only when at least two pages share the same role or the active page depends on the primitive. After changing a shared primitive, run a small cross-page regression check before returning to the active page lock.

## Scoring Sanity And Visual Comparison

Run `scripts/visual_compare.js` to render a local HTML/URL target and produce pixel diff summary plus diff image. Keep reference and candidate screenshots in the same viewport, height, device scale factor, color scheme, locale, font loading state, animation state, route, and application state.

Before trusting visual scores:

- Reference and candidate dimensions match exactly.
- Score JSON, reference, candidate, rendered, and diff artifacts are fresh.
- Masks stay within bounds and do not overlap unless intentionally allowed.
- Score invariants hold: `0 <= uiMaskedMismatch <= fullPageMismatch <= 100`.
- Console and network errors are checked when they affect rendering, fonts, images, icons, or route state.

Use `scripts/visual_artifact_check.js --score score.json --newer-than <changed-source-or-reference>` before quoting saved score evidence.

When image-like masks exist, use `uiMaskedMismatch` as the primary UI acceptance score and `fullPageMismatch` as a global regression guard. Unexpectedly large masked-pixel ratios require review.

Local-region diagnostics are for focused component tuning after macro layout and content are correct:

- `regionMismatch[]`: per-region visual mismatch.
- `regionGeometry[]`: bounding-box deltas such as `dx`, `dy`, `dw`, `dh`, center delta, and spacing deltas.
- `localCropMismatch`: focused crop mismatch for one component.

## Text Visibility And OCR

Run DOM text checks before OCR. `scripts/visual_text_visibility_check.js --target <page> --manifest text-visibility.json --output text-visibility-summary.json` catches expected text that is missing, zero-sized, hidden by display/visibility/opacity, clipped by overflow or viewport, covered at its center point, below contrast threshold, or rendered with an unexpected line-box count.

Use `scripts/visual_ocr_compare.js` on actual reference and candidate PNGs after DOM visibility passes, or when screenshot-only references make DOM matching unavailable. OCR line diagnostics catch missing reference lines, changed line wraps, line-top deltas, width/height mismatch, and large `dy` values that pixelmatch can hide.

Use stricter OCR similarity such as `--min-similarity 0.85` for final text-line wrapping. Lower thresholds are useful during exploration but can hide partial-line matches.

When source HTML exists, run `scripts/typography_probe.js` to inspect computed `font-family`, `font-size`, `font-weight`, `line-height`, and loaded fonts before building typography search spaces.

## Interaction Validation

Static screenshots do not prove a UI works. Use `scripts/visual_interaction_check.js --target <page> --manifest interactions.json` for hover, focus, click, modal, route, fill, keypress, visible/hidden, text, CSS, count, and URL assertions.

Treat failed interaction checks as product or implementation issues, not visual polish. For WebVIA-like multi-state work, record state IDs and expected transitions in the workflow ledger.

## First-Render Triage

After first render, classify the dominant mismatch before editing:

1. `scorer-or-capture`: stale artifacts, viewport mismatch, mask bug, font/asset loading, route/state mismatch.
2. `missing-content`: absent text, icons, controls, rows, cards, sections, overlays, states.
3. `macro-layout`: shell, columns, hierarchy, page offsets, scroll/framing, responsive structure.
4. `shared-primitive`: token, shell, nav, card, table, button, input, icon language, typography pattern affecting multiple pages.
5. `text-visibility`: hidden, clipped, overlapped, low-contrast, or incorrectly wrapped text.
6. `asset-raster`: photos, maps, charts, avatars, screenshots, generated illustrations dominate diff.
7. `local-component`: one button, row, card, badge, input, tab, or modal is wrong after macro layout is correct.
8. `polish-noise`: small color, border, shadow, spacing, antialiasing, or font-render differences.

Choose patches from this classification. Do not run `visual_local_search.js` while capture, content, macro layout, text visibility, or asset policy is still wrong.

## Page Focus

Default to a page-focused loop. Pick the active page by user priority, vertical-slice milestone, closest active fidelity gate, worst user-visible blocker, or shared primitive impact.

Stay on that target until its gate is met, it is explicitly blocked, three measured probes fail to improve it, a shared primitive needs cross-page review, the user changes priority, or backend/API/state work must happen first. Scoreboard refreshes are diagnostics; they do not reset the active-page lock.

Maintain `templates/visual-workflow-ledger.md` for long-running, multi-page, benchmark, or release-polish work. Checkpoint after each full scoreboard refresh or every 60-90 minutes. Run `scripts/visual_ledger_check.js --ledger visual-workflow-ledger.md` after ledger updates and before switching pages.

## Refinement And Local Search

Patch priority:

1. Missing or extra content.
2. Layout hierarchy and placement.
3. Responsive behavior and overflow.
4. Typography scale and line wrapping.
5. Color, spacing, borders, shadows, polish.

Use `scripts/visual_refine_loop.js` for bounded template-driven variants. Use `scripts/visual_local_search.js` only after content, macro layout, text visibility, and asset policy are under control. Keep search variables narrow: text flow, vertical rhythm, component sizing, image dimensions, color, and local alignment. Do not let search invent arbitrary CSS.

For text-heavy screens, rerun `visual_ocr_compare.js`. If OCR diagnostics fail after pixel-only local search, use `scripts/visual_ocr_local_search.js` and report the tradeoff explicitly.

Low-level subagent patch passes can help with mechanical CSS combinations when the spec is complete. Use fast models only for tightly scoped 1-2 file changes; use stronger models for integration, debugging, or architecture. Always review subagent patches against the source-of-truth evidence and rerun visual checks.

## Final Readiness

Use `scripts/visual_readiness_report.js` as the final evidence aggregator. Strict gates should include the evidence relevant to the active fidelity stage:

```bash
node scripts/visual_readiness_report.js \
  --score score.json \
  --newer-than src/App.tsx \
  --ledger visual-workflow-ledger.md \
  --interaction-summary interaction-summary.json \
  --text-visibility-summary text-visibility-summary.json \
  --ocr-summary ocr-summary.json \
  --max-ui-mismatch 3 \
  --require-ledger \
  --require-interactions \
  --require-text-visibility \
  --require-ocr \
  --require-regions
```

The report validates artifact freshness, optional `evidence-freshness`, score sanity, thresholds, ledger discipline, interaction/text-visibility/OCR summary JSON with `ok: true`, and component-region diagnostics. Missing or invalid supporting evidence is a readiness blocker.

## Benchmark Validation

To validate the skill itself, use a public benchmark fixture before project-specific work. Prefer a source that provides reference screenshot plus source HTML or structured state, then run:

- source-of-truth ranking and structured handoff
- design-system census for multi-screen sets
- implementation or candidate capture at fixed viewport
- `visual_compare.js` with masks/regions when appropriate
- `visual_text_visibility_check.js` and `visual_ocr_compare.js` for text-heavy screens
- `visual_interaction_check.js` for stateful UI
- `visual_readiness_report.js` with required evidence flags

Record whether failures are due to candidate implementation, unavailable assets/fonts, screenshot-only ambiguity, scoring setup, or skill/tooling gaps.

## Anti-Patterns

- Treating a generated mockup as backend/API truth before structured handoff.
- Starting with pixel-perfect work before component inventory, data contracts, and core states are known.
- Hand-entering crop boxes when DOM selectors or Figma nodes are available.
- Masking ordinary UI to improve the score.
- Replacing photos, maps, or charts with CSS approximations when exact or representative assets are required.
- Counting page-wide icons instead of auditing icons per row/card/subline.
- Continuing CSS search while text is covered, hidden, or clipped.
- Jumping pages without a page-lock exit condition and switch reason.
- Reporting readiness from old artifacts or missing evidence.

## Output Report

Include these fields when reporting implementation results:

- source of truth used and evidence level: `verified from source`, `inferred from image`, or `not yet checked`
- stack/components touched
- breakpoints checked
- first-render/latest mismatch classification
- active page/flow lock and switch reason
- backend/API/data-model work that can proceed in parallel
- screenshots, diff image, score JSON, mask manifest, region manifest, OCR/text evidence, interaction summary, readiness report
- latest `uiMaskedMismatch`, `fullPageMismatch`, region mismatches, and geometry deltas
- text visibility and OCR status
- interaction validation status
- subagent patch status if used
- blockers, accepted scope limits, and next patch
