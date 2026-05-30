# Representative Workflow Validation Design

## Purpose

The skill now has a concise entrypoint, detailed methodology references, and strong individual helper scripts. The remaining reliability gap is end-to-end validation: a future maintainer can run unit tests for each helper, but there is no representative design-to-code fixture proving the full evidence chain works together.

## Chosen Approach

Add `scripts/visual_workflow_fixture_check.js`, a deterministic smoke harness that creates a small representative UI fixture and runs the existing tools together.

The fixture should produce evidence for:

- source-of-truth selection
- design-system census
- render/capture artifacts
- visual comparison
- local component regions
- text visibility
- OCR/text summary
- interaction validation
- final readiness report

The script should emit a summary JSON with `ok: true`, artifact paths, evidence booleans, and readiness report status. It should fail nonzero when any required evidence is missing or invalid.

## Fixture Shape

Use temporary HTML files rather than a full app:

- `reference.html` and `candidate.html` with the same dashboard-like UI.
- Visible heading, card, button, icon-like glyph, and modal interaction.
- Stable DOM selectors for region generation, interaction assertions, and text visibility.
- A ledger file that records source of truth, design-system census, active page lock, artifacts, text/OCR, interactions, checkpoints, and final verification.

The candidate can match the reference closely enough for strict readiness while still exercising rendering, comparison, text, interaction, and readiness tools.

## Tool Chain

The harness should run:

- `visual_compare.js` to render/capture and score the candidate against the reference screenshot.
- `visual_region_manifest.js` to create component regions from DOM selectors.
- `visual_text_visibility_check.js` to validate expected visible text.
- `visual_ocr_compare.js` to produce OCR/text summary from reference and rendered candidate PNGs.
- `visual_interaction_check.js` to validate a modal click state.
- `visual_readiness_report.js` with strict required evidence flags.

## Testing

Add `scripts/test_visual_workflow_fixture_check.js`.

The test should run the harness with `--output summary.json`, parse the emitted summary, and assert:

- `ok: true`
- source-of-truth and design-system census evidence are present
- all expected artifact paths exist
- visual compare, text visibility, OCR, interaction, and readiness summaries exist and have `ok: true`
- readiness checks include `artifact-freshness`, `evidence-freshness`, `text-visibility-summary`, `ocr-summary`, `interaction-summary`, and `region-diagnostics`

Update `npm test` and README so the validation harness is discoverable.

## Constraints

- Reuse existing scripts; do not duplicate their internals.
- Keep the fixture small enough for the normal test suite.
- Do not make OCR optional in this harness unless the existing OCR test becomes optional too.
- Do not weaken existing readiness gates to make the fixture pass.
