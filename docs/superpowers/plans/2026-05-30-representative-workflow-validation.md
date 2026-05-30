# Representative Workflow Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an end-to-end representative fixture that validates the design-to-frontend workflow evidence chain.

**Architecture:** Create a Node.js CLI harness that writes a temporary UI fixture, runs the existing visual workflow scripts, validates artifacts and summaries, and emits a single workflow summary JSON. Add a test that first fails because the harness does not exist, then passes after implementation.

**Tech Stack:** Node.js, existing Playwright/pixelmatch/OCR helpers, existing readiness report.

---

### Task 1: Failing Workflow Fixture Test

**Files:**
- Create: `scripts/test_visual_workflow_fixture_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a test that runs:

```bash
node scripts/visual_workflow_fixture_check.js --output <tmp>/workflow-summary.json
```

Assert:

```js
assert.equal(result.status, 0, result.stderr || result.stdout);
const summary = JSON.parse(result.stdout);
assert.equal(summary.ok, true);
assert.equal(summary.evidence.sourceOfTruth.ok, true);
assert.equal(summary.evidence.designSystemCensus.ok, true);
assert.equal(summary.evidence.visualCompare.ok, true);
assert.equal(summary.evidence.textVisibility.ok, true);
assert.equal(summary.evidence.ocr.ok, true);
assert.equal(summary.evidence.interactions.ok, true);
assert.equal(summary.evidence.readiness.ok, true);
```

Also assert every artifact path listed in `summary.artifacts` exists, and readiness checks include `artifact-freshness`, `evidence-freshness`, `text-visibility-summary`, `ocr-summary`, `interaction-summary`, and `region-diagnostics`.

- [ ] **Step 2: Wire the test into `npm test`**

Add `&& node scripts/test_visual_workflow_fixture_check.js` after `test_visual_readiness_report.js`.

- [ ] **Step 3: Verify red**

Run: `node scripts/test_visual_workflow_fixture_check.js`

Expected: FAIL because `scripts/visual_workflow_fixture_check.js` does not exist.

### Task 2: Implement Workflow Fixture Harness

**Files:**
- Create: `scripts/visual_workflow_fixture_check.js`

- [ ] **Step 1: Implement CLI shell**

Use `parseArgs` from `visual_compare.js`. Accept `--output` and optional `--work-dir`. Create a temporary work directory when omitted.

- [ ] **Step 2: Generate fixture files**

Write:

- `reference.html`
- `candidate.html`
- `region-source.json`
- `text-visibility.json`
- `interactions.json`
- `visual-workflow-ledger.md`

Use deterministic HTML with dashboard title, card, button, and modal interaction.

- [ ] **Step 3: Run existing scripts**

Run child processes with `process.execPath`:

- `visual_compare.js` to render reference screenshot from `reference.html`
- `visual_region_manifest.js` to generate `regions.json`
- `visual_compare.js` again against `candidate.html` with `--region-manifest regions.json`
- `visual_text_visibility_check.js`
- `visual_ocr_compare.js`
- `visual_interaction_check.js`
- `visual_readiness_report.js`

- [ ] **Step 4: Emit summary**

Emit JSON:

```json
{
  "ok": true,
  "workDir": "...",
  "evidence": {
    "sourceOfTruth": { "ok": true },
    "designSystemCensus": { "ok": true },
    "visualCompare": { "ok": true },
    "textVisibility": { "ok": true },
    "ocr": { "ok": true },
    "interactions": { "ok": true },
    "readiness": { "ok": true }
  },
  "artifacts": {}
}
```

Write the same JSON to `--output` when provided. Exit nonzero if any evidence is false.

- [ ] **Step 5: Verify green**

Run: `node scripts/test_visual_workflow_fixture_check.js`

Expected: PASS.

### Task 3: Documentation And Guards

**Files:**
- Modify: `README.md`
- Modify: `references/visual-execution-guide.md`
- Modify: `scripts/test_skill_content.js`

- [ ] **Step 1: Add script to README included files**

Document `scripts/visual_workflow_fixture_check.js`.

- [ ] **Step 2: Add benchmark/testing guidance**

In the execution guide, mention the fixture harness under `Benchmark Validation`.

- [ ] **Step 3: Add content guards**

Require `scripts/visual_workflow_fixture_check.js` in README and execution guide content.

- [ ] **Step 4: Run full verification**

Run: `npm test`.

Expected: every test passes.

### Task 4: Sync, Commit, Push

**Files:**
- Copy changed skill files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow`

- [ ] **Step 1: Sync installed skill files and verify**

Copy `README.md`, `references/visual-execution-guide.md`, `scripts/test_skill_content.js`, `scripts/test_visual_workflow_fixture_check.js`, `scripts/visual_workflow_fixture_check.js`, and `package.json`; verify with `cmp -s`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add README.md package.json references/visual-execution-guide.md scripts/test_skill_content.js scripts/test_visual_workflow_fixture_check.js scripts/visual_workflow_fixture_check.js docs/superpowers/specs/2026-05-30-representative-workflow-validation-design.md docs/superpowers/plans/2026-05-30-representative-workflow-validation.md
git commit -m "test: add representative workflow validation"
git push
```
