# Readiness Evidence Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visual readiness report reject stale optional evidence files, not just stale score artifacts.

**Architecture:** Reuse `visual_artifact_check.baselineFromOptions` and `statIfExists` inside `visual_readiness_report.js`. Add one readiness-level `evidence-freshness` check for optional ledger, interaction summary, and OCR summary paths when a freshness baseline is provided.

**Tech Stack:** Node.js, existing CommonJS scripts, built-in filesystem mtimes.

---

### Task 1: Failing Optional Evidence Freshness Test

**Files:**
- Modify: `scripts/test_visual_readiness_report.js`

- [ ] **Step 1: Add failing stale optional evidence assertion**

After the existing stale `diff` assertion, restore `diff` to fresh and make `interaction-summary.json` stale:

```js
touch(paths.diff, freshTime);
touch(paths.interactionSummary, staleTime);

const staleEvidenceFailure = runReadiness(script, paths);
assert.notEqual(staleEvidenceFailure.status, 0);
assert.match(staleEvidenceFailure.stderr, /evidence-freshness/i);
assert.match(staleEvidenceFailure.stderr, /interaction-summary/i);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_readiness_report.js`

Expected: FAIL because stale optional evidence is not yet checked.

### Task 2: Implement Evidence Freshness Check

**Files:**
- Modify: `scripts/visual_readiness_report.js`

- [ ] **Step 1: Import baseline helpers**

Import `baselineFromOptions` and `statIfExists` from `visual_artifact_check.js`.

- [ ] **Step 2: Add optional evidence path collection**

Add:

```js
function optionalEvidencePaths(options) {
  return [
    ["ledger", options.ledger],
    ["interaction-summary", options.interactionSummary],
    ["ocr-summary", options.ocrSummary],
  ].filter(([, filePath]) => Boolean(filePath));
}
```

- [ ] **Step 3: Add freshness checker**

Add:

```js
function checkEvidenceFreshness(options) {
  const baseline = baselineFromOptions({
    newerThan: options.newerThan,
    minMtime: options.minMtime,
  });
  if (!baseline) return null;
  const evidence = optionalEvidencePaths(options).map(([role, filePath]) => {
    const resolved = path.resolve(filePath);
    const stat = statIfExists(resolved);
    const mtimeMs = stat ? stat.mtimeMs : null;
    return {
      role,
      path: resolved,
      exists: Boolean(stat),
      mtimeMs,
      mtime: stat ? new Date(mtimeMs).toISOString() : null,
      stale: Boolean(stat) && mtimeMs < baseline.mtimeMs,
    };
  });
  const missing = evidence.filter((item) => !item.exists);
  const stale = evidence.filter((item) => item.stale);
  if (missing.length || stale.length) {
    return fail("evidence-freshness", [
      ...missing.map((item) => `${item.role} is missing: ${item.path}`),
      ...stale.map((item) => `${item.role} is stale: ${item.path}`),
    ].join("; "), { baseline, evidence, missing, stale });
  }
  return pass("evidence-freshness", { baseline, evidence });
}
```

- [ ] **Step 4: Include check only when applicable**

After `artifact-freshness`, append `evidence-freshness` when `checkEvidenceFreshness(options)` returns a result.

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

Require README and SKILL content to mention `evidence-freshness`.

- [ ] **Step 2: Update docs**

Document that `--newer-than` freshness applies to optional ledger, interaction summary, and OCR summary evidence when those paths are supplied.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_readiness_report.js scripts/visual_readiness_report.js docs/superpowers/specs/2026-05-30-readiness-evidence-freshness-design.md docs/superpowers/plans/2026-05-30-readiness-evidence-freshness.md
git commit -m "feat: validate readiness evidence freshness"
git push
```
