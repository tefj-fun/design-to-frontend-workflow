# Readiness Evidence Freshness Design

## Purpose

The visual readiness report already checks that `score.json` and its referenced screenshots/diff are fresh. It still allows optional supporting evidence, such as the workflow ledger, interaction summary, and OCR summary, to be older than the current source or reference. That can let a long-running visual pass report current readiness while relying on stale interaction or text evidence.

## Chosen Approach

Add an `evidence-freshness` check inside `scripts/visual_readiness_report.js`. The check reuses the same baseline implied by `--newer-than` and `--min-mtime`, then validates optional evidence paths supplied to the readiness command:

- `--ledger`
- `--interaction-summary`
- `--ocr-summary`

If no freshness baseline is provided, the check is not emitted because there is no current source timestamp to compare against. If a baseline is present, every optional evidence file must exist and have an mtime greater than or equal to the baseline.

## Alternatives Considered

1. Keep freshness only in `visual_artifact_check.js`.
   This leaves stale supporting evidence undetected.

2. Add separate CLI commands for ledger, interaction, and OCR freshness.
   This increases agent burden and makes readiness harder to use correctly.

3. Add one readiness-level evidence freshness check.
   This is the selected option because the readiness report is already the final aggregation gate.

## Testing

Extend `scripts/test_visual_readiness_report.js` so the passing fixture includes fresh optional evidence, then make `interaction-summary.json` stale and assert the readiness report exits nonzero with an `evidence-freshness` blocker.

## Documentation

Update `SKILL.md` and `README.md` to state that readiness report freshness covers optional ledger, interaction, and OCR evidence in addition to score artifacts.
