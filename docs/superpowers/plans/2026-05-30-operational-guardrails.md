# Operational Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guardrails that prevent long visual-refinement loops from wasting time on bad tooling state, ambiguous stopping criteria, or unsafe low-level delegation.

**Architecture:** Keep `SKILL.md` concise and move detailed procedure into `references/visual-execution-guide.md` and `README.md`. Add one focused preflight utility under `scripts/` and one test file for it. Strengthen `scripts/test_skill_content.js` so future edits preserve the new workflow rules.

**Tech Stack:** Node.js CLI scripts, Playwright, PNGJS, existing content tests, GitHub Actions for CI.

---

### Task 1: Content Guardrails

**Files:**
- Modify: `scripts/test_skill_content.js`
- Modify: `SKILL.md`
- Modify: `references/visual-execution-guide.md`
- Modify: `README.md`
- Modify: `templates/visual-workflow-ledger.md`

- [ ] **Step 1: Write failing content assertions**

Add assertions to `scripts/test_skill_content.js` requiring these exact guardrails:

```js
'scripts/visual_preflight_check.js',
'Run preflight before long-running visual loops',
'Stop low-level visual tuning after three measured probes fail to improve the active gate',
'Development readiness is separate from visual readiness',
'fast subagent patch pass',
'parent/controller reviews the diff and reruns full-page plus local-region comparison',
'## Preflight',
'## Development Readiness',
'## Stop Budget',
```

- [ ] **Step 2: Verify content test fails**

Run:

```bash
node scripts/test_skill_content.js
```

Expected: FAIL because the new strings are not present yet.

- [ ] **Step 3: Add concise entrypoint and detailed reference text**

Update `SKILL.md` with only short operational rules. Put the longer explanation in `references/visual-execution-guide.md`, `README.md`, and the ledger template.

- [ ] **Step 4: Verify content test passes**

Run:

```bash
node scripts/test_skill_content.js
```

Expected: PASS.

### Task 2: Preflight Utility

**Files:**
- Create: `scripts/visual_preflight_check.js`
- Create: `scripts/test_visual_preflight_check.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `references/visual-execution-guide.md`

- [ ] **Step 1: Write failing preflight tests**

Create `scripts/test_visual_preflight_check.js` with tests that execute:

```bash
node scripts/visual_preflight_check.js --output summary.json
node scripts/visual_preflight_check.js --reference reference.png --candidate candidate.png --output summary.json
node scripts/visual_preflight_check.js --require-tesseract --tesseract-bin definitely-not-installed --output summary.json
```

Expected behavior:
- Base run passes and reports Node plus required package checks.
- Reference/candidate PNG dimension check passes when dimensions match.
- Required Tesseract check fails with a named `tesseract` check.

- [ ] **Step 2: Verify preflight test fails**

Run:

```bash
node scripts/test_visual_preflight_check.js
```

Expected: FAIL because `scripts/visual_preflight_check.js` does not exist.

- [ ] **Step 3: Implement minimal preflight script**

Implement CLI support for:

```bash
node scripts/visual_preflight_check.js \
  --target <url-or-file> \
  --reference reference.png \
  --candidate candidate.png \
  --require-tesseract \
  --output preflight-summary.json
```

The script should emit JSON with `{ ok, checks }`. Checks should include `node`, `playwright-package`, `pngjs-package`, optional `tesseract`, optional `target-render`, optional `image-dimensions`, and fail clearly when required evidence is missing or invalid.

- [ ] **Step 4: Wire into test suite**

Add `node scripts/test_visual_preflight_check.js` to the `npm test` command.

- [ ] **Step 5: Verify focused and full tests pass**

Run:

```bash
node scripts/test_visual_preflight_check.js
npm test
```

Expected: PASS.

### Task 3: CI And Installed Skill Sync

**Files:**
- Create: `.github/workflows/test.yml`
- Modify/copy installed skill files under `/Users/josephtsao/.codex/skills/design-to-frontend-workflow`

- [ ] **Step 1: Add GitHub Actions test workflow**

Create `.github/workflows/test.yml` that runs on push and pull request:

```yaml
name: test
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: sudo apt-get update && sudo apt-get install -y tesseract-ocr
      - run: npm test
```

- [ ] **Step 2: Sync installed skill**

Copy changed `SKILL.md`, references, templates, scripts, package files, and CI-independent docs into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow`.

- [ ] **Step 3: Verify sync and tests**

Run:

```bash
npm test
cmp -s SKILL.md /Users/josephtsao/.codex/skills/design-to-frontend-workflow/SKILL.md
```

Expected: PASS.

### Task 4: Completion Audit

**Files:**
- Inspect all changed files and command output.

- [ ] **Step 1: Verify full objective coverage**

Check that current evidence covers concise loading, progressive disclosure, visual workflow, acceptance criteria, benchmark guidance, artifacts, anti-patterns, representative validation, OCR/text checks, interactions, readiness report, preflight, stop budget, and development-readiness separation.

- [ ] **Step 2: Commit and push**

Run:

```bash
git status --short
git add .
git commit -m "feat: add visual workflow operational guardrails"
git push
```

Expected: clean pushed branch.
