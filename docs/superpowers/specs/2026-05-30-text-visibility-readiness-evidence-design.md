# Text Visibility Readiness Evidence Design

## Purpose

The workflow now has `scripts/visual_text_visibility_check.js`, but final readiness can still pass without proving that this pre-OCR DOM text check was run. That leaves a gap: agents may correctly add text-visibility evidence during diagnosis and then omit it from the final `visual_readiness_report.js` gate.

## Chosen Approach

Add first-class text-visibility evidence to `scripts/visual_readiness_report.js`.

The report should accept:

- `--text-visibility-summary text-visibility-summary.json`
- `--require-text-visibility`

When a summary path is supplied, the report should:

- include it in `evidence-freshness` when `--newer-than` or `--min-mtime` is present
- parse it as JSON
- require `ok: true`
- emit a check named `text-visibility-summary`
- report missing or invalid files as named readiness blockers

When `--require-text-visibility` is supplied without a summary path, the report should fail with a `required-text-visibility` blocker.

## Alternatives Considered

1. Keep text visibility separate from readiness.
   This preserves a diagnostic tool but does not prevent final reports from skipping the evidence.

2. Fold text visibility into OCR evidence.
   That hides the pipeline order. Text visibility is a DOM/layout check that should happen before OCR.

3. Add a dedicated readiness evidence type.
   This is the selected approach because it matches the existing ledger, interaction, OCR, and region evidence model.

## Testing

Update `scripts/test_visual_readiness_report.js` so the passing fixture includes a fresh `text-visibility-summary.json` with `ok: true` and expects `text-visibility-summary` in the check list.

Add failing assertions for:

- missing required text-visibility evidence
- supplied text-visibility summary with `ok: false`
- stale text-visibility summary when freshness is enforced

## Documentation

Update `SKILL.md`, `README.md`, and `scripts/test_skill_content.js` so strict final readiness examples include `--text-visibility-summary` and `--require-text-visibility` before OCR evidence.
