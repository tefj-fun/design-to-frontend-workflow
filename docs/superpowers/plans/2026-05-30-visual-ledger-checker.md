# Visual Ledger Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CLI checker that validates the visual workflow ledger's active-page lock and checkpoint discipline.

**Architecture:** Create `scripts/visual_ledger_check.js` as a Markdown parser/checker for `templates/visual-workflow-ledger.md`-style files. It should verify required sections, require active-page metadata, parse checkpoint table rows, and flag page switches across checkpoints unless the Active Page Lock section records a switch reason.

**Tech Stack:** Node.js, built-in `node:assert/strict`, `spawnSync`.

---

### Task 1: Failing Ledger Checker Test

**Files:**
- Create: `scripts/test_visual_ledger_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create two temporary ledgers:

```markdown
## Active Page Lock

- Active page/route/state: Dashboard
- Why this page is active: release target
- Entry score: 8%
- Current score: 5%
- Best-known score: 5%
- Exit condition: uiMaskedMismatch < 3%
- Switch reason, if changing pages:

## Checkpoints

| Time | Active page | Current/best score | Accepted changes | Rejected hypotheses | Blocker class | Next patch | Gate feasible? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 09:00 | Dashboard | 5/5 | button fix | spacing | local-component | cards | yes |
```

and an invalid one whose checkpoint table changes from `Dashboard` to `Settings` while the switch reason is blank.

Assert the valid ledger exits `0` and prints `ok: true`; assert the invalid ledger exits nonzero and includes `checkpoint page switched`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_ledger_check.js`

Expected: FAIL because `scripts/visual_ledger_check.js` does not exist.

- [ ] **Step 3: Wire test into package script**

Add `&& node scripts/test_visual_ledger_check.js` after the skill-content test.

### Task 2: Checker Implementation

**Files:**
- Create: `scripts/visual_ledger_check.js`

- [ ] **Step 1: Implement section parsing**

Parse Markdown `##` sections into a map and require `Active Page Lock` and `Checkpoints`.

- [ ] **Step 2: Implement labeled bullet extraction**

Extract values for `Active page/route/state`, `Exit condition`, and `Switch reason, if changing pages` from the active-page section. Fail if active page or exit condition are blank.

- [ ] **Step 3: Implement checkpoint table parsing**

Parse pipe-table rows under `## Checkpoints`, skip separator rows, and extract the `Active page` column. Fail when checkpoint rows exist but the active-page column is missing or blank.

- [ ] **Step 4: Implement page-switch rule**

If checkpoint rows contain more than one unique active page and the switch reason is blank, fail with `checkpoint page switched without Switch reason`.

- [ ] **Step 5: Run targeted verification**

Run: `node scripts/test_visual_ledger_check.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_ledger_check.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_ledger_check.js`

- [ ] **Step 1: Add content tests**

Require README and SKILL content to mention `scripts/visual_ledger_check.js`.

- [ ] **Step 2: Update docs**

Document using the checker after checkpoint updates or before switching active pages.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add package.json SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_ledger_check.js scripts/visual_ledger_check.js docs/superpowers/plans/2026-05-30-visual-ledger-checker.md
git commit -m "feat: validate visual workflow ledgers"
git push
```
