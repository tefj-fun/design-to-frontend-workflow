# Visual Artifact Freshness Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CLI checker that rejects stale or missing visual comparison evidence before an agent reports scores.

**Architecture:** Create `scripts/visual_artifact_check.js` as a small filesystem verifier for `visual_compare.js` score JSON. It should confirm referenced screenshots and diffs exist, optionally confirm the score JSON exists, and compare artifact mtimes against one or more `--newer-than` source files or a `--min-mtime` timestamp.

**Tech Stack:** Node.js, built-in `node:assert/strict`, `spawnSync`.

---

### Task 1: Failing Artifact Checker Test

**Files:**
- Create: `scripts/test_visual_artifact_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a temp directory with reference, candidate, diff, source, and score JSON:

```json
{
  "reference": "/tmp/reference.png",
  "candidate": "/tmp/candidate.png",
  "diff": "/tmp/diff.png",
  "width": 2,
  "height": 1,
  "mismatchPercent": 50
}
```

Set the source file mtime older than all artifacts and assert:

```bash
node scripts/visual_artifact_check.js --score score.json --newer-than source.html
```

exits `0` with `ok: true`.

Then set the diff mtime older than the source file and assert the same command exits nonzero with `diff is stale`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_artifact_check.js`

Expected: FAIL because `scripts/visual_artifact_check.js` does not exist.

- [ ] **Step 3: Wire test into package script**

Add `&& node scripts/test_visual_artifact_check.js` after `test_visual_compare.js`.

### Task 2: Checker Implementation

**Files:**
- Create: `scripts/visual_artifact_check.js`

- [ ] **Step 1: Implement argument parsing**

Reuse `parseArgs` from `visual_compare.js`. Require `--score`. Accept repeated `--newer-than` as comma-separated paths and optional `--min-mtime` ISO timestamp.

- [ ] **Step 2: Implement score parsing and artifact discovery**

Read score JSON. Check the score file itself plus `reference`, `candidate`, `diff`, and optional `rendered` paths when present.

- [ ] **Step 3: Implement freshness comparison**

Compute the newest baseline from all `--newer-than` files and `--min-mtime`. Fail any required artifact whose mtime is older than that baseline.

- [ ] **Step 4: Emit summary**

Return `{ ok, score, baseline, artifacts[] }`, where each artifact includes role, path, exists, mtimeMs, and stale status.

- [ ] **Step 5: Run targeted verification**

Run: `node scripts/test_visual_artifact_check.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_artifact_check.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_artifact_check.js`

- [ ] **Step 1: Add content tests**

Require README and SKILL content to mention `scripts/visual_artifact_check.js`.

- [ ] **Step 2: Update docs**

Document running the checker after `visual_compare.js` and before reporting visual scores.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add package.json SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_artifact_check.js scripts/visual_artifact_check.js docs/superpowers/plans/2026-05-30-visual-artifact-freshness-checker.md
git commit -m "feat: validate visual artifact freshness"
git push
```
