---
name: design-to-frontend-workflow
description: Use when turning screenshots, generated images, Figma mockups, visual design references, or UI screenshots into real frontend code. Guides Codex through a reusable design-to-code workflow using structured handoff, component extraction, local rendering, screenshot comparison, responsive checks, and interaction validation. Especially relevant for React/Next.js/Tailwind frontend work, Figma-to-code handoff, image-to-HTML questions, requests to make a frontend match a mockup, or methodology/equation questions about design-to-code papers such as Design2Code, Figma2Code, VisRefiner, UI2Code^N, and WebVIA.
---

# Design To Frontend Workflow

## Overview

Use this skill to convert visual UI intent into maintainable frontend code without relying on a one-shot screenshot-to-code prompt. Prefer structured design data, component decomposition, local rendering, visual comparison, and interaction checks.

For paper background and method mapping, read `references/paper-workflow-map.md` when the user asks why this workflow is valid or wants citations. Read `references/paper-methodology-notes.md` when the user asks whether the workflow is actually grounded in paper methodology, equations, objectives, rewards, or metrics. Read `references/benchmark-fixtures.md` when forward-testing the skill itself against public benchmark samples.

## Grounding Rules

- Distinguish paper-supported steps from practical adaptations. Do not claim Codex is running a paper's trained model unless that model/tool is actually installed and used.
- Treat Figma metadata as useful but risky: it improves visual grounding, but absolute coordinates and primitive style attributes can produce brittle, hard-to-maintain code.
- Treat visual similarity metrics as diagnostic signals, not proof of production readiness. Pair visual checks with code quality, responsiveness, and interaction checks.
- If the user asks for citations, methodology, or equations, load the relevant reference file and cite the exact paper role used.
- If the user asks to test whether the skill works, use a public benchmark fixture first, then a project-specific mockup.

## Workflow

### 1. Establish The Source Of Truth

Choose the strongest available source, in this order:

1. Figma file with metadata, assets, and named layers.
2. Figma frame or structured design spec derived from an image.
3. High-resolution screenshot or generated mockup plus extracted text/assets.
4. Low-resolution image, treated only as rough visual direction.

If only an image exists, create a lightweight handoff before coding:

- Component inventory: screens, panels, cards, controls, maps, tables, modals.
- Text inventory: headings, labels, values, button text, empty/error states.
- Token inventory: colors, typography scale, spacing, radii, borders, shadows.
- Asset inventory: icons, photos, maps, logos, placeholder handling.
- Responsive targets: desktop, tablet, mobile widths.
- Known uncertainty: text accuracy, hidden states, unavailable assets, inferred interactions.

For important UI components, create a component-region manifest before scoring:

- Mark components that should be locally compared: primary buttons, form controls, tabs, nav items, cards, table rows, badges, icons with labels, modals, and other high-signal repeated units.
- Record each region's semantic id, owner text or selector, expected bounding box at each checked viewport, crop padding, component state, and which text/icons/overlays are part of the score.
- Prefer source-derived boxes from Figma nodes, benchmark DOM, or rendered element bounding boxes. If boxes are inferred from a screenshot, label them as inferred and verify them visually before using them for acceptance claims.
- Keep component regions aligned to real UI boundaries. Do not crop so tightly that the score hides neighbor spacing, focus rings, shadows, or label alignment.
- Use component regions for diagnosis and targeted refinement, not as a replacement for the global page comparison.

For rendered images or image-like regions, create a mask manifest before scoring:

- Mark regions that are inherently raster or externally rendered: photos, video thumbnails, maps, satellite tiles, charts, canvas/WebGL, screenshots inside the UI, avatars, generated illustrations, ads, and QR/barcode-like images.
- Record each region's expected bounding box, border radius, aspect ratio, object-fit/crop behavior, visible overlays, labels, and whether the actual pixels are required or only representative.
- Do not mask normal UI primitives, icons, text, buttons, form controls, cards, borders, shadows, or layout containers.
- If a raster region contains UI text or controls over the image, mask only the image pixels and keep overlays in the scored UI layer whenever practical.
- If the user or benchmark requires exact image fidelity, do not mask that region; score it as content.

Icons are first-class assets, not decorative afterthoughts. Before coding, build an icon manifest:

- List every visible icon by semantic role, screen region, owner text or component, approximate size, stroke/fill style, color, and state.
- For repeated structures such as tables, lists, cards, nav items, and form rows, record which exact row/card/item labels and sublabels require icons. A global icon count is not enough.
- For cards with metadata lines, inventory icons at subline level, such as household/person count, location pin, timestamp, status, category, and action affordances.
- Prefer the repo's existing icon system or a proven library such as Lucide, Heroicons, Material Symbols, or the app's design-system icons when the shape matches the reference.
- If source HTML, Figma SVGs, or exported assets are available, extract the exact SVG path data instead of approximating by memory.
- If no matching icon exists, create a small inline SVG component from the screenshot or design reference. Keep it semantic, reusable, and scoped to the icon role rather than embedding a raster crop.
- If the icon is too ambiguous to reconstruct, mark it as a known uncertainty and create the closest simple SVG placeholder with the correct size, color, stroke width, and position. Do not omit it.
- Never use icon fonts unless the app already depends on them and the font file is verified to load locally.

Stop and ask for missing source material only when the ambiguity would materially change the build, such as unknown product data, missing required assets, or unclear target stack.

### 2. Generate Component-First Frontend

Translate the design into the target app stack and local conventions. For React/Next.js work:

- Build real components instead of one large HTML copy.
- Use semantic layout and responsive CSS rather than absolute-positioning the whole page.
- Preserve real app data flow and state boundaries.
- Use the repo's existing component library, icons, tokens, and styling patterns.
- Treat the visual design as a target, not as permission to bypass maintainability.
- Convert absolute Figma positions into flex/grid/layout primitives unless the UI element is inherently fixed-format, such as a map overlay, chart canvas, or design preview.

### 3. Render And Capture

Run the frontend locally and capture screenshots at the agreed breakpoints. Default breakpoints:

- Desktop: `1440` width.
- Tablet: `768` width.
- Mobile: `390` width.

Use Playwright or the browser tooling available in the current environment. Capture the reference and implementation in the same viewport size when possible.

When available, use `scripts/visual_compare.js` to render a local HTML/URL target and produce a pixel-diff summary plus diff image. It requires Node packages `playwright`, `sharp`, `pngjs`, and `pixelmatch`; if the current environment lacks them, use the bundled Codex workspace runtime or another installed browser workflow.

Use two visual scores when image-like regions are present:

- `uiMaskedMismatch`: primary acceptance score. Exclude approved mask-manifest regions from pixel mismatch so maps/photos/thumbnails do not dominate UI layout and typography tuning.
- `fullPageMismatch`: secondary diagnostic score. Include every pixel so unexpected image, map, or media regressions remain visible.

When a component-region manifest exists, also emit local comparison diagnostics:

- `regionMismatch[]`: per-region visual mismatch scores for each named component crop, reported with the region id, viewport, and state.
- `regionGeometry[]`: per-region bounding-box deltas such as `dx`, `dy`, `dw`, `dh`, center delta, and nearest-neighbor spacing delta when relevant.
- `localCropMismatch`: the pixel or perceptual mismatch for one focused component crop, such as a button, input, table row, or card subline.

Use local diagnostics to explain and tune specific components after content and macro layout are correct. Keep `uiMaskedMismatch` as the primary acceptance score and `fullPageMismatch` as the global regression guard.

For masked regions, still verify presence and geometry:

- Element exists and loads without console/network errors.
- Bounding box, aspect ratio, crop/object-fit, border radius, and position match the reference.
- Overlay text, controls, badges, map pins, chart labels, and other UI layers are scored or separately checked.
- The chosen representative image is acceptable for the product context, even if exact pixels differ.

Run an icon render audit after the first capture and after any icon-related patch:

- Check manifest coverage item by item: for each expected icon, find the corresponding owner label/component/row/card in the rendered DOM and verify an icon exists inside or immediately adjacent to that owner region.
- Count expected versus rendered icons per region, not only page-wide totals. For example, if a comparison-table label such as `Purchase price range` has an icon in the reference, the rendered row label must contain or neighbor an icon; unrelated icons elsewhere do not satisfy it.
- For repeated cards, audit each card's expected subline icons separately. A card-level hero icon or selected-state check icon does not satisfy missing metadata icons such as person-count or location-pin icons.
- Check each rendered icon has nonzero width and height, visible `display`/`visibility`/`opacity`, and at least one vector child for inline SVGs.
- Check network and console logs for missing SVG, font, sprite, or image assets.
- Compare rendered icon size, stroke width, fill/stroke mode, color, and local position against the reference region.
- Treat missing, zero-sized, invisible, wrong-library, or visually weak icons as content mismatches, not polish.
- If a library icon fails visual review, replace it with a closer library icon or a custom SVG component before tuning typography/spacing.

When a structured reference is available, such as benchmark source HTML or an approved implementation, pass `--reference-html` to emit text, layout, and color diagnostics in addition to pixelmatch. These diagnostics help classify the remaining mismatch:

- `diagnostics.text.similarity`: whether visible content matches.
- `diagnostics.layout.score`: whether matched visible blocks have similar position and size.
- `diagnostics.color.score`: whether foreground/background colors match for the visible blocks.

For screenshot-only work, these diagnostics are unavailable unless you first create a reliable structured handoff. Do not infer text/layout/color scores from pixelmatch alone.

For text-heavy screenshots, DOM element boxes are not enough because paragraph elements can match while rendered line wrapping differs. When local OCR is available, run `scripts/visual_ocr_compare.js` on the actual reference and candidate PNGs to compare rendered text-line boxes:

- Use OCR line diagnostics before accepting pixel-only improvements on text-heavy pages.
- Treat missing reference lines, changed line wraps, or large line `dy` values as real visual mismatches even if pixelmatch improves.
- Use DOM diagnostics for component/block geometry and OCR diagnostics for rendered text-line geometry.
- Use a stricter `--min-similarity` such as `0.85` when validating final text-line wrapping; lower values are useful during exploration but can hide partial-line matches.

### 4. Compare Visually And Patch

Compare reference versus rendered implementation. Prioritize fixes in this order:

1. Missing or extra content.
2. Layout hierarchy and component placement.
3. Responsive behavior and overflow.
4. Typography scale and line wrapping.
5. Color, spacing, borders, shadows, and polish.

Patch the implementation, rerender, and repeat until the largest mismatches are resolved. Do not claim visual parity without fresh screenshot evidence.

Default acceptance target: continue the render-compare-patch loop until `uiMaskedMismatch` is below `3%` at the primary reference viewport. If there are no approved image-like masks, `uiMaskedMismatch` is the same as global full-page pixel mismatch. Do not stop above `3%` just because the structure looks right. If the masked UI mismatch cannot be reduced below `3%`, document the blocking cause and evidence, such as unavailable source assets, unmasked raster differences, font rendering differences, antialiasing-only noise, or a user-approved scope limit. When the user asks to optimize or match the benchmark, run additional targeted passes rather than stopping at the first plateau.

Before each loop iteration, classify the top mismatch region:

1. Missing or wrong content, including icons and unmasked imagery.
2. Geometry/layout position and component sizing.
3. Typography, line wrapping, and text weight.
4. Color, borders, shadows, and antialiasing.

Fix higher-priority regions before lower-priority tuning. A lower pixel score is not acceptable if it hides text, drops icons, masks non-raster UI, or worsens OCR/layout diagnostics.

For component-sized mismatches, use local comparison as a focused patch loop:

1. Identify the reference and candidate bounding boxes from the component-region manifest, DOM boxes, or verified screenshot coordinates.
2. Crop both screenshots with enough padding to include shadows, focus rings, adjacent label spacing, and alignment context.
3. Compare the local crop for content, icon presence, text wrapping, padding, radius, border, shadow, color, and internal alignment.
4. Check `regionGeometry[]` against the full-page coordinates so the component does not match locally while drifting globally.
5. Patch only the component, token, or layout primitive tied to the measured delta.
6. Rerun the full-page comparison and the local crop comparison. Accept the patch only if the targeted local score improves and global UI scores, OCR/text diagnostics, and neighboring layout do not regress beyond renderer noise.

Example: for a button, local crop comparison can catch label centering, padding, radius, border, icon gap, and hover/focus state errors that barely affect `fullPageMismatch`. The full-page score still decides whether the button remains in the right page position and preserves surrounding spacing.

#### Optional Subagent Patch Pass

Use a Spark subagent pass only for bounded, low-level mechanical edits after diagnosis is complete (typically 1-2 files), such as component padding, radius, token combinations, icon gap, typography knobs, or small local alignment changes.

The parent/controller agent owns visual diagnosis, prompt construction, diff review, and final acceptance. Do not delegate architecture, broad layout strategy, ambiguous design decisions, or final visual approval to the Spark worker. If the worker is blocked by reasoning limits, escalate/re-dispatch with a stronger model.

Before dispatch, provide the worker with:
- observed visual delta,
- target component/region id,
- allowed files and write scope,
- allowed tunable values,
- screenshot/diff artifacts (if available),
- verification commands,
- acceptance criteria.

The worker must report:
- changed files,
- changed components/tokens,
- verification run,
- concerns or risks.

The parent must review the diff and rerun both full-page and local-region visual comparison before accepting the patch.

When the remaining mismatch is small enough that manual guessing is inefficient, use `scripts/visual_refine_loop.js` with a template and a variants JSON file:

- Replace only tunable values with placeholders, such as `{{mainWidth}}`, `{{bodyFontSize}}`, `{{paragraphMarginBottom}}`, or `{{buttonPaddingX}}`.
- Keep the variants targeted to observed failure modes: text flow, vertical rhythm, component sizing, image dimensions, color, or local alignment.
- Render every candidate in the same viewport as the reference.
- Score global mismatch and inspect regional mismatch from the emitted grid.
- Accept global-layout candidates only when they reduce global mismatch. Accept component-local candidates only when they improve the targeted `localCropMismatch` or `regionGeometry[]` without regressing `uiMaskedMismatch`, OCR/text diagnostics, icon coverage, or neighboring layout.
- Stop that refinement pass when no candidate improves, or when visual review shows the pixel metric is mostly antialiasing, font availability, or reference-render noise. If the accepted result is still at or above `3%`, start a new pass against the next highest mismatch class or document the hard blocker with evidence.

The loop is an engineering harness, not an optimizer that understands design intent. Use it to choose between plausible implementation patches, then keep the accepted values in maintainable component/CSS code.

If hand-authored variants plateau, use `scripts/visual_local_search.js` with a search-space JSON file. This applies a UI2Code^N-style closed-loop search over tunable implementation variables while reusing one browser session:

- Use it only after the component structure and content are already correct.
- Search parameters that diagnostics identify as weak, such as heading line height, button font size, padding, vertical rhythm, and image dimensions.
- Keep the search space bounded to plausible design values; do not let the script invent arbitrary CSS.
- Accept the measured best candidate per pass and stop when a pass has no improvement.
- Re-run `visual_compare.js --reference-html` afterward when source HTML or another structured reference exists, to ensure pixel gains did not harm text/layout/color quality.
- For text-heavy screens, also re-run `visual_ocr_compare.js`; reject or flag a pixel improvement if it worsens OCR line positions or hides a reference line.

If OCR diagnostics fail after pixel-only local search, run `scripts/visual_ocr_local_search.js` instead of continuing to tune by eye:

- Use the same template/search-space pattern as `visual_local_search.js`, plus `--ocr-reference` pointing at the reference screenshot.
- Include text-flow knobs in the search space: font family, font size, font weight, line height, content width, paragraph margins, and vertical offsets.
- Rank candidates by OCR line integrity first: missing reference/candidate lines, max line-top delta, average line-top delta, line width/height deltas, then pixel mismatch.
- A small temporary pixel regression is acceptable when it restores a missing OCR line; the loop should then use spacing and sizing knobs to bring pixel mismatch back down.
- If using `--max-mismatch-percent`, do not set it so tightly that it blocks missing-line recovery. The script still considers candidates that reduce missing OCR lines even if they slightly exceed the pixel cap.
- After OCR-aware search, rerun both `visual_compare.js` and `visual_ocr_compare.js`. Report the tradeoff explicitly, such as "pixel-only scored lower but hid a reference line; OCR-aware scored higher but preserved all text lines."

When a structured reference HTML/URL exists, run `scripts/typography_probe.js` before building the OCR search space:

- Extract computed `font-family`, `font-size`, `font-weight`, `line-height`, and loaded `document.fonts` data from visible text roles.
- Merge the probe output into a bounded search space rather than trusting it blindly; source HTML can declare a font that the local renderer does not actually load.
- If the typography-probed search worsens pixel or strict OCR metrics, keep the previous OCR-valid candidate and report the probe as a diagnostic, not an accepted improvement.

GPU-backed perceptual metrics such as LPIPS or DISTS can be useful when pixelmatch disagrees with human review, but do not replace DOM/text/layout diagnostics for frontend implementation. Add them only when the local environment has the model/runtime and the mismatch is mainly antialiasing, texture, or tiny raster noise.

When using automated or manual visual diffing, write the observed deltas in implementation terms:

- "Card grid starts 24px too low" instead of "layout is off."
- "Mobile filter drawer overlaps map controls" instead of "mobile broken."
- "Hero image missing; source asset unavailable" instead of "image differs."
- "Text score is 1.0; remaining error is layout/color/pixel antialiasing" instead of "the implementation is wrong."

### 5. Validate Interactions

After static visual matching, verify interactive states:

- Navigation and route changes.
- Filters, search, sorting, tabs, drawers, and modals.
- Hover, focus, selected, loading, empty, and error states.
- Mobile menus and touch-sized controls.
- Map/list synchronization or other domain-specific UI behavior.

For workflow-heavy apps, inspect multiple states instead of only the first screen.

## Output Expectations

When reporting results, include:

- Source of truth used.
- Evidence level: `verified from source`, `inferred from image`, or `not yet checked`.
- Stack/components touched or proposed.
- Breakpoints checked.
- Screenshots or visual evidence when implementation occurred.
- Latest `uiMaskedMismatch` percentage, `fullPageMismatch` percentage, and whether the `<3%` masked UI acceptance target was met.
- Subagent patch status (not used, in progress, pending review, accepted, or blocked/re-dispatched).
- Component-region manifest status: not needed, source-derived, DOM-derived, screenshot-inferred, or not yet checked.
- Latest important `regionMismatch[]`, `regionGeometry[]`, or `localCropMismatch` results when component-local comparison was used.
- Mask manifest status: no masks, image-like regions masked with geometry checked, exact raster content required, or not yet checked.
- Icon manifest status: source-extracted, library-mapped, custom SVG-created, placeholder with uncertainty, or not yet checked.
- Known mismatches or tradeoffs.
- Next refinement step if parity is not yet reached.

## Anti-Patterns

Avoid these unless the user explicitly asks for a throwaway prototype:

- Converting one full-page screenshot into one monolithic component.
- Using absolute coordinates for the entire UI.
- Omitting icons because the exact library icon is unavailable.
- Letting maps/photos/video thumbnails dominate the primary UI score without reporting a masked UI score.
- Masking text, controls, icons, borders, or layout errors as if they were raster image differences.
- Replacing full-page comparison with isolated component crops, causing locally matched controls to drift from the surrounding layout.
- Ignoring responsive behavior because the desktop screenshot looks close.
- Treating generated image text as reliable without extracting or checking it.
- Claiming the frontend matches the mockup without rendering and comparing.
- Letting a cheap/fast worker drive visual strategy decisions or approve visual acceptance without parent-side review.
