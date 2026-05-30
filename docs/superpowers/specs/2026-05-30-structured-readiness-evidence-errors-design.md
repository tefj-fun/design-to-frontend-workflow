# Structured Readiness Evidence Errors Design

## Purpose

The readiness report now supports strict evidence requirements, but supplied evidence paths can still produce raw filesystem or JSON exceptions. A missing `--ledger`, `--interaction-summary`, or `--ocr-summary` file should be reported as a named readiness check failure, not as an uncategorized Node error. Long-running visual work needs all failures to be comparable in the same blocker list.

## Chosen Approach

Make evidence readers fail closed inside their own checks:

- `checkLedgerEvidence()` catches missing/unreadable ledger files and returns a failed `ledger` check.
- `checkSummaryJson()` catches missing/unreadable/invalid JSON summary files and returns a failed `interaction-summary` or `ocr-summary` check.
- The CLI still exits nonzero when blockers exist, but stderr contains named readiness blockers rather than raw `ENOENT` or JSON parse stack context.

This keeps `--score` as a required input that can fail fast, while turning optional or required supporting evidence into reportable readiness checks.

## Alternatives Considered

1. Let Node exceptions bubble.
   This makes failures harder to classify and can hide multiple blockers behind the first exception.

2. Add a separate file-existence precheck for every evidence path.
   This duplicates logic already implied by ledger and summary checks.

3. Catch evidence read/parse failures inside each evidence checker.
   This is the selected approach because it keeps each check responsible for its own evidence.

## Testing

Extend `scripts/test_visual_readiness_report.js` with missing supplied evidence cases:

- Supplied but missing `--interaction-summary` fails with an `interaction-summary` blocker instead of crashing.
- Supplied but missing `--ledger` fails with a `ledger` blocker instead of crashing.

## Documentation

Update `SKILL.md` and README to describe readiness evidence failures as named checks, including missing or invalid ledger/interaction/OCR evidence.
