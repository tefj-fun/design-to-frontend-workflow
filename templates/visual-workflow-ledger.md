# Visual Workflow Ledger

Use this ledger for multi-page visual implementation, benchmark matching, long-running refinement, or any design-to-frontend task where the agent may otherwise lose track of source material, page focus, artifacts, or rejected hypotheses.

## Source Of Truth

- Primary reference:
- Secondary references:
- Structured source available:
- Screenshot-only uncertainties:
- Viewports and states in scope:
- Explicit exclusions:

## Design-System Census

- Shared shell/layout:
- Tokens:
- Shared components:
- Shared icon language:
- Page templates:
- Asset/raster policy:
- Exceptions that should stay separate:
- Deferred primitives:

## Fidelity Gate

- Active gate: concept / structured handoff / vertical slice / release polish / benchmark / pixel-critical component
- Target score or non-score acceptance rule:
- Backend/API/data work allowed in parallel:
- Hard blockers to visual work:

## Active Page Lock

- Active page/route/state:
- Why this page is active:
- Entry score:
- Current score:
- Best-known score:
- Exit condition:
- Switch reason, if changing pages:

## Scoring Harness Sanity

- Viewport, height, DPR, color scheme, locale, and route/state match:
- Screenshot dimensions match:
- Fonts/assets loaded:
- Fresh reference/current/diff/score artifacts:
- Mask boxes checked:
- Score invariant `0 <= uiMaskedMismatch <= fullPageMismatch <= 100`:
- Console/network issues:

## First-Render Triage

- Dominant class: scorer-or-capture / missing-content / macro-layout / shared-primitive / text-visibility / asset-raster / local-component / polish-noise
- Evidence:
- Strategy chosen:
- Reclassification history:

## Asset Decisions

| Region | Policy | Evidence | Follow-up |
| --- | --- | --- | --- |
|  | exact-required / representative-accepted / generated-replacement / blocked |  |  |

## Text Visibility And OCR

- DOM text existence checked:
- Client rects and line boxes checked:
- Overflow clipping checked:
- Overlap / elementFromPoint checked:
- Contrast checked:
- OCR run and result:

## Shared Primitive Regression Budget

| Primitive | Affected pages | Baseline evidence | Result | Accepted? |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Artifact Ledger

| Artifact | Path |
| --- | --- |
| Reference screenshot |  |
| Current screenshot |  |
| Diff image |  |
| Score JSON |  |
| Mask manifest |  |
| Component-region manifest |  |
| OCR/text diagnostics |  |
| Structured reference diagnostics |  |

## Patch Ledger

| Patch | Type | Evidence | Outcome |
| --- | --- | --- | --- |
|  | visual / semantic-only / scorer-fix / rejected-regression |  |  |

## Checkpoints

Checkpoint after every full scoreboard refresh or every 60-90 minutes.

| Time | Active page | Current/best score | Accepted changes | Rejected hypotheses | Blocker class | Next patch | Gate feasible? |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

## Final Verification

- Active fidelity gate met or blocker documented:
- Full-page and masked scores verified:
- Local component regions verified:
- Text/OCR diagnostics verified where needed:
- Interaction states checked:
- Responsive breakpoints checked:
- Shared primitive regressions checked:
- Known tradeoffs:
- Next step:
