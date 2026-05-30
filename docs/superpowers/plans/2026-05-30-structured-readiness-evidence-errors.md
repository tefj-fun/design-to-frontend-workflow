# Structured Readiness Evidence Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make missing or invalid supplied readiness evidence produce named readiness check failures instead of raw filesystem or JSON exceptions.

**Architecture:** Keep `score.json` as the required root artifact, but make optional supporting evidence checks self-contained. `checkLedgerEvidence()` and `checkSummaryJson()` should catch file read and parse failures and return failed check objects.

**Tech Stack:** Node.js, existing CommonJS readiness report CLI and test harness.

---

### Task 1: Failing Missing Evidence Tests

**Files:**
- Modify: `scripts/test_visual_readiness_report.js`

- [ ] **Step 1: Add missing supplied interaction summary assertion**

After the initial passing readiness assertion, run:

```js
const missingInteractionFile = runReadinessArgs(script, [
  "--score",
  paths.score,
  "--interaction-summary",
  path.join(tmp, "missing-interaction-summary.json"),
  "--max-ui-mismatch",
  "3",
]);
assert.notEqual(missingInteractionFile.status, 0);
assert.match(missingInteractionFile.stderr, /interaction-summary/i);
assert.match(missingInteractionFile.stderr, /missing/i);
```

- [ ] **Step 2: Add missing supplied ledger assertion**

Run:

```js
const missingLedgerFile = runReadinessArgs(script, [
  "--score",
  paths.score,
  "--ledger",
  path.join(tmp, "missing-ledger.md"),
  "--max-ui-mismatch",
  "3",
]);
assert.notEqual(missingLedgerFile.status, 0);
assert.match(missingLedgerFile.stderr, /ledger/i);
assert.match(missingLedgerFile.stderr, /missing/i);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node scripts/test_visual_readiness_report.js`

Expected: FAIL because the current script throws raw filesystem errors instead of named check blockers.

### Task 2: Implement Structured Evidence Failures

**Files:**
- Modify: `scripts/visual_readiness_report.js`

- [ ] **Step 1: Add helper for file read errors**

Add:

```js
function missingOrInvalidEvidence(name, label, filePath, error) {
  const resolved = path.resolve(filePath);
  const reason = error && error.code === "ENOENT" ? "missing" : "invalid";
  return fail(name, `${label} is ${reason}: ${resolved}`, {
    path: resolved,
    reason,
    error: error.message,
  });
}
```

- [ ] **Step 2: Wrap ledger file reads**

Change `checkLedgerEvidence()` so `fs.readFileSync()` is inside the `try` block:

```js
function checkLedgerEvidence(ledgerPath) {
  try {
    const markdown = fs.readFileSync(path.resolve(ledgerPath), "utf8");
    return pass("ledger", checkLedger(markdown, ledgerPath));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return missingOrInvalidEvidence("ledger", "ledger", ledgerPath, error);
    }
    return fail("ledger", error.message, { ledger: path.resolve(ledgerPath) });
  }
}
```

- [ ] **Step 3: Wrap summary JSON reads**

Change `checkSummaryJson()`:

```js
function checkSummaryJson(name, filePath) {
  let summary;
  try {
    summary = readJson(filePath);
  } catch (error) {
    return missingOrInvalidEvidence(name, name, filePath, error);
  }
  ...
}
```

- [ ] **Step 4: Export helper**

Export `missingOrInvalidEvidence`.

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

Require README and SKILL content to mention `missing or invalid`.

- [ ] **Step 2: Update docs**

Document that readiness report evidence failures include missing or invalid ledger, interaction summary, and OCR summary files as named blockers.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_readiness_report.js scripts/visual_readiness_report.js docs/superpowers/specs/2026-05-30-structured-readiness-evidence-errors-design.md docs/superpowers/plans/2026-05-30-structured-readiness-evidence-errors.md
git commit -m "feat: structure readiness evidence errors"
git push
```
