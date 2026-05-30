# Visual Interaction Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manifest-driven Playwright checker for interaction states that static screenshots cannot prove.

**Architecture:** Create `scripts/visual_interaction_check.js` as a CLI that opens a local HTML/URL target, executes a list of state actions from JSON, and verifies selector visibility, text, CSS, focus, count, and URL expectations. The checker should output a JSON summary and fail fast with a useful message when a required state cannot be reached or verified.

**Tech Stack:** Node.js, Playwright, built-in `node:assert/strict`, `spawnSync`.

---

### Task 1: Failing Interaction Checker Test

**Files:**
- Create: `scripts/test_visual_interaction_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a temp HTML fixture with:

- a button that opens a modal on click
- an input that can receive focus
- a hoverable button with a hover background color

Create a manifest:

```json
{
  "states": [
    {
      "id": "open-modal",
      "actions": [{ "type": "click", "selector": "#open" }],
      "assertions": [
        { "type": "visible", "selector": "#modal" },
        { "type": "text", "selector": "#modal", "contains": "Modal ready" }
      ]
    },
    {
      "id": "focus-name",
      "actions": [{ "type": "focus", "selector": "#name" }],
      "assertions": [{ "type": "focused", "selector": "#name" }]
    },
    {
      "id": "hover-open",
      "actions": [{ "type": "hover", "selector": "#open" }],
      "assertions": [{ "type": "css", "selector": "#open", "property": "backgroundColor", "equals": "rgb(0, 128, 0)" }]
    }
  ]
}
```

Assert the checker exits `0` and reports all three states passed. Then create a broken manifest asserting a missing selector is visible and assert the checker exits nonzero with the state id.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_interaction_check.js`

Expected: FAIL because `scripts/visual_interaction_check.js` does not exist.

- [ ] **Step 3: Wire test into package script**

Add `&& node scripts/test_visual_interaction_check.js` after `test_visual_ledger_check.js`.

### Task 2: Checker Implementation

**Files:**
- Create: `scripts/visual_interaction_check.js`

- [ ] **Step 1: Implement argument parsing**

Reuse `parseArgs`, `parsePositiveInt`, and `targetToUrl` from `visual_compare.js`. Require `--target` and `--manifest`; accept optional `--width`, `--height`, and `--output`.

- [ ] **Step 2: Implement actions**

Support `click`, `hover`, `focus`, `fill`, `press`, and `waitForSelector`. Wait briefly after each action so DOM state settles.

- [ ] **Step 3: Implement assertions**

Support `visible`, `hidden`, `text` with `equals` or `contains`, `focused`, `css` with `equals` or `contains`, `count`, and `url`.

- [ ] **Step 4: Emit summary**

Return `{ ok, target, width, height, passed, failed, states[] }`, write it to `--output` when provided, and exit nonzero on any failed state.

- [ ] **Step 5: Run targeted verification**

Run: `node scripts/test_visual_interaction_check.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_interaction_check.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_interaction_check.js`

- [ ] **Step 1: Add content tests**

Require README and SKILL content to mention `scripts/visual_interaction_check.js`.

- [ ] **Step 2: Update docs**

Document using the checker after static visual matching and before claiming workflow readiness.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add package.json SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_interaction_check.js scripts/visual_interaction_check.js docs/superpowers/plans/2026-05-30-visual-interaction-checker.md
git commit -m "feat: validate visual interaction states"
git push
```
