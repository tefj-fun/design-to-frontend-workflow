# Text Visibility Readiness Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `visual_readiness_report.js` enforce text-visibility evidence as a first-class final readiness gate.

**Architecture:** Reuse the existing readiness-report evidence pattern. Add a `textVisibilitySummary` option, include it in freshness checks, validate the summary JSON with `ok: true`, add a `--require-text-visibility` required-path gate, and document the new CLI flags.

**Tech Stack:** Node.js, existing project CLI helpers, existing readiness report tests.

---

### Task 1: Failing Readiness Test

**Files:**
- Modify: `scripts/test_visual_readiness_report.js`

- [ ] **Step 1: Add passing text-visibility evidence to the fixture**

Add `textVisibilitySummary: path.join(tmp, "text-visibility-summary.json")` to the `paths` object.

Write:

```js
fs.writeFileSync(paths.textVisibilitySummary, JSON.stringify({ ok: true, passed: 2, failed: 0 }, null, 2));
```

Pass the summary to `runReadiness()`:

```js
"--text-visibility-summary",
paths.textVisibilitySummary,
```

Update the expected check list to include `"text-visibility-summary"` after `"interaction-summary"` and before `"ocr-summary"`.

- [ ] **Step 2: Add failing cases**

Add three cases:

```js
const missingTextVisibility = runReadinessArgs(script, [
  "--score",
  paths.score,
  "--newer-than",
  paths.source,
  "--max-ui-mismatch",
  "3",
  "--require-text-visibility",
]);
assert.notEqual(missingTextVisibility.status, 0);
assert.match(missingTextVisibility.stderr, /required-text-visibility/i);

fs.writeFileSync(paths.textVisibilitySummary, JSON.stringify({ ok: false, failed: 1 }, null, 2));
touch(paths.textVisibilitySummary, freshTime);
const failedTextVisibility = runReadiness(script, paths);
assert.notEqual(failedTextVisibility.status, 0);
assert.match(failedTextVisibility.stderr, /text-visibility-summary/i);

fs.writeFileSync(paths.textVisibilitySummary, JSON.stringify({ ok: true, passed: 2, failed: 0 }, null, 2));
touch(paths.textVisibilitySummary, staleTime);
const staleTextVisibility = runReadiness(script, paths);
assert.notEqual(staleTextVisibility.status, 0);
assert.match(staleTextVisibility.stderr, /evidence-freshness/i);
assert.match(staleTextVisibility.stderr, /text-visibility-summary/i);
```

- [ ] **Step 3: Verify red**

Run: `node scripts/test_visual_readiness_report.js`

Expected: FAIL because `visual_readiness_report.js` does not parse `--text-visibility-summary` or `--require-text-visibility`.

### Task 2: Implement Readiness Support

**Files:**
- Modify: `scripts/visual_readiness_report.js`

- [ ] **Step 1: Include text visibility in freshness evidence**

Update `optionalEvidencePaths()` to return:

```js
["text-visibility-summary", options.textVisibilitySummary],
```

- [ ] **Step 2: Add required-path check**

After the interaction required check, add:

```js
if (options.requireTextVisibility) {
  checks.push(checkRequiredPath("required-text-visibility", "text visibility summary", options.textVisibilitySummary));
}
```

- [ ] **Step 3: Add summary validation**

After interaction summary validation, add:

```js
if (options.textVisibilitySummary) {
  checks.push(checkSummaryJson("text-visibility-summary", options.textVisibilitySummary));
}
```

- [ ] **Step 4: Parse CLI flags**

In `main()`, pass:

```js
textVisibilitySummary: args["text-visibility-summary"] || null,
requireTextVisibility: Boolean(args["require-text-visibility"]),
```

- [ ] **Step 5: Verify green**

Run: `node scripts/test_visual_readiness_report.js`

Expected: PASS.

### Task 3: Documentation And Guard Tests

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`

- [ ] **Step 1: Update content guards**

Require the strings:

- `--text-visibility-summary`
- `--require-text-visibility`
- `text-visibility-summary`

- [ ] **Step 2: Update README**

Add `--text-visibility-summary text-visibility-summary.json` and `--require-text-visibility` to the readiness report command. Explain that text visibility summary JSON must have `ok: true`.

- [ ] **Step 3: Update SKILL**

Update the readiness report command and evidence description so strict final gates include text visibility evidence before OCR evidence.

- [ ] **Step 4: Run full verification**

Run: `npm test`

Expected: every test passes.

### Task 4: Sync, Commit, Push

**Files:**
- Copy changed skill files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow`

- [ ] **Step 1: Sync installed skill files**

Copy changed files and verify with `cmp -s`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_readiness_report.js scripts/visual_readiness_report.js docs/superpowers/specs/2026-05-30-text-visibility-readiness-evidence-design.md docs/superpowers/plans/2026-05-30-text-visibility-readiness-evidence.md
git commit -m "feat: require text visibility readiness evidence"
git push
```
