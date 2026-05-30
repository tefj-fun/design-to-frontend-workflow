# Required Readiness Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit readiness-report flags that fail when required ledger, interaction, OCR, or region evidence is omitted.

**Architecture:** Extend `scripts/visual_readiness_report.js` with small missing-evidence checks before existing optional validators run. Keep existing optional behavior unchanged unless `--require-ledger`, `--require-interactions`, `--require-ocr`, or `--require-regions` is present.

**Tech Stack:** Node.js, existing CommonJS scripts and test harness.

---

### Task 1: Failing Required Evidence Tests

**Files:**
- Modify: `scripts/test_visual_readiness_report.js`

- [ ] **Step 1: Add helper for custom readiness args**

Add a helper near `runReadiness`:

```js
function runReadinessArgs(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: process.env,
  });
}
```

- [ ] **Step 2: Add missing interaction evidence assertion**

After the passing case, run the CLI without `--interaction-summary` but with `--require-interactions`:

```js
const missingInteraction = runReadinessArgs(script, [
  "--score", paths.score,
  "--newer-than", paths.source,
  "--max-ui-mismatch", "3",
  "--require-interactions",
]);
assert.notEqual(missingInteraction.status, 0);
assert.match(missingInteraction.stderr, /required-interactions/i);
```

- [ ] **Step 3: Add missing ledger/OCR/region assertion**

Create a score JSON without region diagnostics and run with `--require-ledger`, `--require-ocr`, and `--require-regions` but no matching evidence paths:

```js
const noRegionScore = path.join(tmp, "score-no-regions.json");
fs.writeFileSync(noRegionScore, JSON.stringify({
  reference: paths.reference,
  candidate: paths.candidate,
  diff: paths.diff,
  width: 2,
  height: 1,
  fullPageMismatch: 2.5,
  uiMaskedMismatch: 1.5,
  sanity: { dimensionsMatch: true, scoreInvariantOk: true, regionCount: 0 },
  regionMismatch: []
}, null, 2));
touch(noRegionScore, freshTime);

const missingStrictEvidence = runReadinessArgs(script, [
  "--score", noRegionScore,
  "--newer-than", paths.source,
  "--max-ui-mismatch", "3",
  "--require-ledger",
  "--require-ocr",
  "--require-regions",
]);
assert.notEqual(missingStrictEvidence.status, 0);
assert.match(missingStrictEvidence.stderr, /required-ledger/i);
assert.match(missingStrictEvidence.stderr, /required-ocr/i);
assert.match(missingStrictEvidence.stderr, /region-diagnostics/i);
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node scripts/test_visual_readiness_report.js`

Expected: FAIL because `--require-interactions`, `--require-ledger`, and `--require-ocr` are not yet implemented.

### Task 2: Implement Required Evidence Flags

**Files:**
- Modify: `scripts/visual_readiness_report.js`

- [ ] **Step 1: Add required path checker**

Add:

```js
function checkRequiredPath(name, label, filePath) {
  if (!filePath) {
    return fail(name, `${label} is required but no path was provided`);
  }
  return pass(name, { path: path.resolve(filePath) });
}
```

- [ ] **Step 2: Include checks in report**

Before optional evidence validators, add:

```js
if (options.requireLedger) checks.push(checkRequiredPath("required-ledger", "ledger", options.ledger));
if (options.requireInteractions) checks.push(checkRequiredPath("required-interactions", "interaction summary", options.interactionSummary));
if (options.requireOcr) checks.push(checkRequiredPath("required-ocr", "OCR summary", options.ocrSummary));
```

- [ ] **Step 3: Parse CLI flags**

Map:

```js
requireLedger: Boolean(args["require-ledger"]),
requireInteractions: Boolean(args["require-interactions"]),
requireOcr: Boolean(args["require-ocr"]),
```

- [ ] **Step 4: Export helper**

Export `checkRequiredPath` for direct testability.

- [ ] **Step 5: Run targeted verification**

Run: `node scripts/test_visual_readiness_report.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_readiness_report.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_readiness_report.js`

- [ ] **Step 1: Add content test guards**

Require README and SKILL content to mention `--require-ledger`, `--require-interactions`, and `--require-ocr`.

- [ ] **Step 2: Update docs**

Document strict final readiness examples with the new flags:

```bash
node scripts/visual_readiness_report.js \
  --score score.json \
  --newer-than src/App.tsx \
  --ledger visual-workflow-ledger.md \
  --interaction-summary interaction-summary.json \
  --ocr-summary ocr-summary.json \
  --max-ui-mismatch 3 \
  --require-ledger \
  --require-interactions \
  --require-ocr \
  --require-regions
```

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_readiness_report.js scripts/visual_readiness_report.js docs/superpowers/specs/2026-05-30-required-readiness-evidence-design.md docs/superpowers/plans/2026-05-30-required-readiness-evidence.md
git commit -m "feat: require visual readiness evidence"
git push
```
