---
name: design-to-frontend-workflow
description: Use when turning screenshots, generated images, Figma mockups, UI screenshots, visual references, or design-system screen sets into frontend code; when matching a frontend to a mockup; or when answering methodology questions about Design2Code, Figma2Code, VisRefiner, UI2Code^N, WebVIA, visual fidelity metrics, OCR/text comparison, masks, component crops, or render-based UI verification.
---

# Design To Frontend Workflow

## Overview

Convert visual UI intent into maintainable frontend code with structured handoff, component-first implementation, local rendering, visual comparison, text/OCR checks, interaction validation, and final readiness evidence. Do not rely on one-shot screenshot-to-code prompting, and do not treat pixel parity as a universal prerequisite for backend or product development.

Use this entrypoint as the control plane. Load `references/visual-execution-guide.md` for detailed procedure, examples, manifests, triage rules, local search, benchmark validation, and output report fields.

For paper background and method mapping, read `references/paper-workflow-map.md` when the user asks why this workflow is valid or wants citations. Read `references/paper-methodology-notes.md` for methodology, equations, objectives, rewards, or metrics. Read `references/benchmark-fixtures.md` when forward-testing the skill against public benchmark samples.

## Progressive Disclosure

| Need | Load |
| --- | --- |
| Detailed execution steps, manifests, triage, local search, anti-patterns, output report | `references/visual-execution-guide.md` |
| Paper support and method mapping | `references/paper-workflow-map.md` |
| Equations, objectives, rewards, metric notes | `references/paper-methodology-notes.md` |
| Public benchmark fixture guidance | `references/benchmark-fixtures.md` |
| Long-running work ledger | `templates/visual-workflow-ledger.md` |

To validate this skill's local evidence chain, run `scripts/visual_workflow_fixture_check.js` before project-specific benchmark work.

## Grounding Rules

- Distinguish paper-supported steps from practical adaptations. Do not claim Codex is running a paper's trained model unless that model/tool is actually installed and used.
- Treat Figma metadata as useful but risky: it improves visual grounding, but absolute coordinates and primitive style attributes can produce brittle code.
- Treat visual similarity metrics as diagnostic signals, not proof of production readiness. Pair visual checks with code quality, responsiveness, accessibility, and interaction checks.
- Development readiness is separate from visual readiness. If the user is building a real app, start backend/API/data work once the structured handoff defines flows, entities, states, contracts, seeded data, and known visual uncertainty.

## Core Workflow

### 1. Establish The Source Of Truth

Choose the strongest available source:

1. Figma file with metadata, assets, and named layers.
2. Figma frame or structured design spec derived from an image.
3. High-resolution screenshot or generated mockup plus extracted text/assets.
4. Low-resolution image, treated only as rough visual direction.

If only an image exists, create a lightweight handoff before coding: component inventory, text inventory, token inventory, asset inventory, responsive targets, and known uncertainty.

For important components, create a component-region manifest. When the component regions can be identified in rendered DOM, use `scripts/visual_region_manifest.js` and pass `--region-manifest` to `scripts/visual_compare.js`.

For image-like regions, create a mask manifest and decide whether each raster asset is `exact-required`, `representative-accepted`, `generated-replacement`, or `blocked`. Do not approximate photos, maps, dense charts, or complex illustrations with CSS/SVG unless the target explicitly requires a coded/vector version.

### 2. Run A Design-System Census Before Page Lock

For multi-screen apps, inspect all provided pages once before optimizing one page. Extract shared shell/layout, tokens, components, icon language, page templates, raster policy, and exceptions.

Use the census to define shared primitives before page-focused optimization. Shared primitive changes need a regression budget: list affected pages, record current evidence, accept only if the active page improves without meaningful affected-page regressions, or split variants by state/density/template.

### 3. Set The Fidelity Gate And Development Track

| Stage | Visual bar | Development track |
| --- | --- | --- |
| Concept mockup | Directionally credible | Explore product direction and major surfaces. |
| Structured handoff | Component/text/token/asset/state inventory exists | Start frontend components, backend/API design, data modeling, and seeded vertical slices. |
| Vertical slice | Core workflow coherent; hidden text, overflow, and missing primary controls fixed | Build one real end-to-end path with contracts, navigation, state, and interaction tests. |
| Release polish | Key screens/components meet agreed target, often `uiMaskedMismatch < 3%` | Tighten local regions, responsiveness, accessibility, edge cases, and final readiness. |

Default benchmark/release target: continue until `uiMaskedMismatch < 3%` at the primary reference viewport unless the user sets another gate or a blocker is documented.

### 4. Generate Component-First Frontend

Build real components, not one large HTML copy. Use semantic layout, responsive CSS, existing repo components/tokens/icons, and real data boundaries. Convert absolute Figma positions into flex/grid/layout primitives unless the UI element is inherently fixed-format.

### 5. Render, Capture, Compare, Patch

Run preflight before long-running visual loops: `scripts/visual_preflight_check.js --target <page> --reference reference.png --candidate candidate.png --require-tesseract --output preflight-summary.json`. Fix missing Playwright, browser, Tesseract, target-route, console/network, image-dimension, or artifact setup problems before CSS tuning.

Default breakpoints: desktop `1440`, tablet `768`, mobile `390`. Capture reference and implementation at the same viewport, height, device scale, color scheme, locale, font state, animation state, route, and state.

When available, use:

- `scripts/visual_compare.js` for render, screenshot, pixel diff, masks, local regions, and optional structured diagnostics.
- `scripts/visual_artifact_check.js --score score.json --newer-than <changed-source-or-reference>` before reporting saved scores.
- `scripts/visual_readiness_report.js --score score.json --newer-than <changed-source-or-reference> --text-visibility-summary text-visibility-summary.json --max-ui-mismatch <target> --require-ledger --require-interactions --require-text-visibility --require-ocr --require-regions` for final or long-running readiness evidence.

Before trusting visual scores, run a scoring harness sanity gate: dimensions match, artifacts are fresh, `evidence-freshness` is valid when supplied, masks stay in bounds, score invariants hold, and no console/network errors affect rendering. Treat missing or invalid ledger, interaction summary, text-visibility summary, and OCR summary files as readiness failures with named blockers.

Use `uiMaskedMismatch` as the primary UI acceptance score when approved image-like masks exist. Keep `fullPageMismatch` as a global regression guard. Use `regionMismatch[]`, `regionGeometry[]`, and `localCropMismatch` for component-local diagnosis after content and macro layout are broadly correct.

### 6. Text, OCR, Icons, And Interactions

For text-heavy screenshots, DOM element boxes are not enough because paragraph elements can match while rendered wrapping differs.

- Before OCR, run a text visibility audit with `scripts/visual_text_visibility_check.js --target <page> --manifest text-visibility.json`: expected text exists, has nonzero client rects, is not hidden by `display`/`visibility`/`opacity`, is not clipped, is not covered at its center point, has readable contrast, and has expected line-box count from `Range.getClientRects()` when practical.
- Use `scripts/visual_ocr_compare.js` after DOM visibility checks pass to verify rendered text-line geometry, reference lines, line wraps, and line deltas.
- Build an icon manifest for visible icon roles, repeated rows/cards, size, stroke/fill, color, and state. Missing, zero-sized, invisible, wrong-library, or visually weak icons are content mismatches.
- Run `scripts/visual_interaction_check.js --target <page> --manifest interactions.json` for hover, focus, click, route, modal, and state changes before claiming readiness.

### 7. Triage And Page Focus

#### First-Render Triage

Classify the dominant mismatch before editing: `scorer-or-capture`, `missing-content`, `macro-layout`, `shared-primitive`, `text-visibility`, `asset-raster`, `local-component`, or `polish-noise`. Do not run low-level CSS search while capture, content, macro layout, text visibility, or asset policy problems dominate.

#### Page Focus And Switching Rules

Default to a page-focused loop. Pick one active page, route, state, or flow segment, then stay there until the fidelity gate is met, the page is blocked, a shared primitive needs cross-page review, the user changes priority, or backend/API/state work must happen first.

Stop low-level visual tuning after three measured probes fail to improve the active gate. Reclassify the blocker, inspect preflight/scorer/text/asset causes, or switch only with a recorded reason.

Use a fast subagent patch pass only for diagnosed 1-2 file mechanical changes such as padding, radius, icon gap, font-size, line-height, or local alignment. The parent/controller reviews the diff and reruns full-page plus local-region comparison before accepting the patch.

During long-running work, checkpoint after every full scoreboard refresh or every 60-90 minutes. Use `templates/visual-workflow-ledger.md` and run `scripts/visual_ledger_check.js --ledger visual-workflow-ledger.md` after ledger updates and before switching active pages.

## Acceptance Criteria

A design-to-frontend pass is ready only when evidence matches the active fidelity gate:

- Source-of-truth selection and uncertainty are recorded.
- Preflight passes or blocking tool/capture issues are documented.
- Design-system census exists for multi-screen work.
- Component, text, token, asset, icon, mask, and region inventories exist where relevant.
- Render/capture artifacts are fresh for the current code and route.
- Visual comparison has valid score sanity and artifact freshness.
- Local component regions are checked when high-signal components matter.
- Text visibility and OCR/text checks are run where text-heavy or wrapping-sensitive UI matters.
- Interaction states are validated for non-static UI.
- Final readiness report passes with required evidence flags for the active gate.
- Code remains maintainable, componentized, responsive, and aligned with repo conventions.

## Anti-Patterns

- One-shot image-to-code with no structured handoff.
- Pixel-perfect blocking before structured handoff or vertical-slice work can begin.
- Running hours of patch/search loops without preflight, stop budget, or blocker reclassification.
- Tuning CSS against stale screenshots, mismatched viewports, invalid masks, or broken score invariants.
- Running local search before content, layout, text visibility, and asset policy are under control.
- Masking normal UI primitives, text, controls, cards, borders, or shadows.
- Omitting icons because they look decorative.
- Jumping between pages without an active page lock, exit condition, and switch reason.
- Reporting visual parity without fresh screenshots, score JSON, text/OCR evidence when needed, interaction evidence when needed, and readiness report status.

## Output Report

When reporting results, include source of truth, evidence level, stack/components touched, breakpoints checked, first-render/latest mismatch classification, active page lock and switch reason, backend/API/data-model parallelization status, screenshots or diff evidence, Artifact ledger path or summary, latest `uiMaskedMismatch` and `fullPageMismatch`, `scripts/visual_readiness_report.js` status with flags such as `--text-visibility-summary`, `--require-ledger`, `--require-interactions`, `--require-text-visibility`, and `--require-ocr`, important `regionMismatch[]` or `regionGeometry[]`, mask status, OCR/text status, interaction status, and any blockers or accepted scope limits.
