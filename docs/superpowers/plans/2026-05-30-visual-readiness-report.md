# Visual Readiness Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one CLI readiness gate that aggregates visual evidence checks before an agent reports a screen or page as visually ready.

**Architecture:** Create `scripts/visual_readiness_report.js` as a lightweight evidence validator that composes existing checker functions instead of rerendering the page. It will validate score JSON sanity, artifact freshness, optional ledger discipline, optional interaction/OCR summary JSON, and optional acceptance thresholds, then emit one JSON report with pass/fail checks and blockers.

**Tech Stack:** Node.js, built-in `fs/path`, existing `visual_compare.parseArgs`, `visual_artifact_check.checkArtifacts`, and `visual_ledger_check.checkLedger`.

---

### Task 1: Failing Readiness Report Test

**Files:**
- Create: `scripts/test_visual_readiness_report.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a temp directory with fresh reference, candidate, diff, source, score JSON, ledger markdown, interaction summary JSON, and OCR summary JSON.

The passing score JSON should include:

```json
{
  "reference": "/tmp/reference.png",
  "candidate": "/tmp/candidate.png",
  "diff": "/tmp/diff.png",
  "width": 2,
  "height": 1,
  "fullPageMismatch": 2.5,
  "uiMaskedMismatch": 1.5,
  "sanity": {
    "dimensionsMatch": true,
    "scoreInvariantOk": true,
    "regionCount": 1
  },
  "regionMismatch": [
    { "id": "primary-button", "mismatchPercent": 0.5 }
  ]
}
```

Run:

```bash
node scripts/visual_readiness_report.js \
  --score score.json \
  --newer-than source.html \
  --ledger visual-workflow-ledger.md \
  --interaction-summary interaction-summary.json \
  --ocr-summary ocr-summary.json \
  --max-ui-mismatch 3 \
  --require-regions
```

Assert the command exits `0`, emits JSON with `ok: true`, and includes checks named `artifact-freshness`, `score-sanity`, `threshold`, `ledger`, `interaction-summary`, `ocr-summary`, and `region-diagnostics`.

Then rewrite the score JSON with `uiMaskedMismatch: 4.5` and assert the same command exits nonzero with stderr containing `threshold`.

Then set the diff artifact mtime older than the source and assert the command exits nonzero with stderr containing `artifact-freshness`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_readiness_report.js`

Expected: FAIL because `scripts/visual_readiness_report.js` does not exist.

- [ ] **Step 3: Wire test into package script**

Add `&& node scripts/test_visual_readiness_report.js` after `test_visual_artifact_check.js`.

### Task 2: Readiness Report Implementation

**Files:**
- Create: `scripts/visual_readiness_report.js`

- [ ] **Step 1: Implement argument parsing**

Reuse `parseArgs` from `visual_compare.js`. Require `--score`. Accept `--newer-than`, `--min-mtime`, `--ledger`, `--interaction-summary`, `--ocr-summary`, `--max-ui-mismatch`, `--max-full-mismatch`, `--require-regions`, and `--output`.

- [ ] **Step 2: Implement check collection**

Create helpers:

```js
function pass(name, summary = {}) {
  return { name, ok: true, ...summary };
}

function fail(name, message, summary = {}) {
  return { name, ok: false, message, ...summary };
}
```

Each check should return a result object instead of throwing except for malformed CLI input.

- [ ] **Step 3: Implement artifact freshness check**

Call `checkArtifacts({ score, newerThan, minMtime })`. Convert missing or stale artifacts into a failed `artifact-freshness` check with blocker messages from `formatFailures`.

- [ ] **Step 4: Implement score sanity and threshold checks**

Read the score JSON and fail `score-sanity` when:

- `sanity.dimensionsMatch` is explicitly `false`
- `sanity.scoreInvariantOk` is explicitly `false`
- `uiMaskedMismatch` or `fullPageMismatch` is outside `0..100`
- `uiMaskedMismatch > fullPageMismatch`

Fail `threshold` when `--max-ui-mismatch` or `--max-full-mismatch` is exceeded.

- [ ] **Step 5: Implement optional evidence checks**

If `--ledger` is provided, read it and call `checkLedger`.

If `--interaction-summary` or `--ocr-summary` is provided, read JSON and require `ok: true`.

If `--require-regions` is provided, require a non-empty `regionMismatch` array or `sanity.regionCount > 0`.

- [ ] **Step 6: Emit report**

Emit:

```json
{
  "ok": true,
  "score": "/abs/score.json",
  "checks": [],
  "blockers": []
}
```

Write the same JSON to `--output` when provided. Exit nonzero when any check fails and print one line per blocker to stderr.

- [ ] **Step 7: Run targeted verification**

Run: `node scripts/test_visual_readiness_report.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_readiness_report.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_readiness_report.js`

- [ ] **Step 1: Add content tests**

Require README and SKILL content to mention `scripts/visual_readiness_report.js` and `--max-ui-mismatch`.

- [ ] **Step 2: Update docs**

Document the readiness report as the final evidence gate before reporting visual results from a long-running visual loop.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add package.json SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_readiness_report.js scripts/visual_readiness_report.js docs/superpowers/plans/2026-05-30-visual-readiness-report.md
git commit -m "feat: add visual readiness report"
git push
```
