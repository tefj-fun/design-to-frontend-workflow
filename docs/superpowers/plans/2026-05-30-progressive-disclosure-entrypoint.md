# Progressive Disclosure Entrypoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `SKILL.md` load-efficient while preserving the full visual verification method through progressive disclosure.

**Architecture:** Add a detailed execution reference and rewrite `SKILL.md` as a concise control-plane entrypoint. Content tests enforce the line budget, required entrypoint pointers, and detailed reference coverage.

**Tech Stack:** Markdown skill files, Node.js content tests.

---

### Task 1: Failing Content Test

**Files:**
- Modify: `scripts/test_skill_content.js`

- [ ] **Step 1: Add entrypoint line budget**

Add:

```js
const skillLines = skill.split(/\r?\n/).length;
assert(skillLines <= 260, `SKILL.md must stay under 260 lines for load efficiency; got ${skillLines}`);
```

- [ ] **Step 2: Load detailed reference**

Add:

```js
const executionGuidePath = path.join(root, 'references', 'visual-execution-guide.md');
const executionGuide = fs.existsSync(executionGuidePath)
  ? fs.readFileSync(executionGuidePath, 'utf8')
  : '';
assert(executionGuide, 'references/visual-execution-guide.md must exist');
```

- [ ] **Step 3: Require progressive-disclosure pointers**

Require `SKILL.md` to include `references/visual-execution-guide.md`.

- [ ] **Step 4: Require detailed coverage in reference**

Assert the execution guide includes:

- `component-region manifest`
- `mask manifest`
- `icon manifest`
- `First-Render Triage`
- `Page Focus`
- `visual_text_visibility_check.js`
- `visual_ocr_compare.js`
- `visual_local_search.js`
- `visual_readiness_report.js`
- `Benchmark Validation`
- `Output Report`

- [ ] **Step 5: Verify red**

Run: `node scripts/test_skill_content.js`

Expected: FAIL because `SKILL.md` exceeds 260 lines and the execution guide does not exist.

### Task 2: Refactor Skill Entrypoint

**Files:**
- Modify: `SKILL.md`
- Create: `references/visual-execution-guide.md`

- [ ] **Step 1: Create detailed execution guide**

Move expanded operational procedure into `references/visual-execution-guide.md`, including source handoff details, component/mask/icon manifests, scoring sanity, OCR/text checks, page focus, local search, interactions, readiness report, benchmark validation, anti-patterns, and output report fields.

- [ ] **Step 2: Rewrite `SKILL.md` as control plane**

Keep a concise entrypoint with:

- overview
- progressive-disclosure reference table
- core workflow steps
- acceptance criteria
- required artifacts
- readiness command
- anti-patterns
- reporting checklist

- [ ] **Step 3: Verify targeted content test**

Run: `node scripts/test_skill_content.js`

Expected: PASS.

### Task 3: README And Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add execution guide to README included-files list**

Add:

```md
- `references/visual-execution-guide.md`: detailed execution procedure for the render-compare-refine workflow.
```

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: every test passes.

### Task 4: Sync, Commit, Push

**Files:**
- Copy changed skill files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow`

- [ ] **Step 1: Sync installed skill files and verify**

Copy `SKILL.md`, `README.md`, `scripts/test_skill_content.js`, and `references/visual-execution-guide.md`; verify with `cmp -s`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add SKILL.md README.md references/visual-execution-guide.md scripts/test_skill_content.js docs/superpowers/specs/2026-05-30-progressive-disclosure-entrypoint-design.md docs/superpowers/plans/2026-05-30-progressive-disclosure-entrypoint.md
git commit -m "docs: compact skill entrypoint"
git push
```
