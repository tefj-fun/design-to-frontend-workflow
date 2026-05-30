# Required Readiness Evidence Design

## Purpose

`scripts/visual_readiness_report.js` aggregates the evidence supplied to it, but final visual gates can still omit important evidence. For example, a long-running release-polish pass can skip `--ledger` or `--interaction-summary` and still receive a passing readiness report if the score artifact is fresh. That is a workflow gap: missing evidence should be explicit when the active gate requires it.

## Chosen Approach

Add required-evidence flags to the readiness report:

- `--require-ledger`
- `--require-interactions`
- `--require-ocr`
- existing `--require-regions`

Each required flag fails the report when its corresponding evidence path or diagnostic is missing. Existing optional behavior remains unchanged when a flag is not provided.

The report will add separate missing-evidence checks before validating provided evidence:

- `required-ledger`
- `required-interactions`
- `required-ocr`
- `region-diagnostics`

This keeps failure reasons clear and avoids overloading the existing ledger or summary checks.

## Alternatives Considered

1. Make ledger, interaction, OCR, and region evidence mandatory for every readiness report.
   This would be too strict for concept or structured-handoff phases where OCR or interaction manifests may not apply.

2. Rely on docs to tell agents to include evidence.
   This is weak because long-running agent loops drift and omit optional flags.

3. Add explicit `--require-*` flags.
   This is the selected approach because it preserves flexibility while enabling strict final gates.

## Testing

Extend `scripts/test_visual_readiness_report.js` with two focused cases:

- A command with `--require-interactions` but no `--interaction-summary` exits nonzero and reports `required-interactions`.
- A command with `--require-ledger --require-ocr --require-regions` but missing those evidence artifacts exits nonzero with named blockers.

## Documentation

Update `SKILL.md` and `README.md` so release-polish, benchmark, and pixel-critical final readiness examples include the relevant `--require-*` flags rather than relying on optional evidence.
