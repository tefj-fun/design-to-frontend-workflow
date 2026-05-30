# Text Visibility Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable DOM text visibility checker that catches hidden, clipped, covered, zero-sized, and low-contrast text before OCR or pixel-only refinement.

**Architecture:** Create `scripts/visual_text_visibility_check.js` as a Playwright-based CLI. It reads a manifest of expected text items, evaluates visibility and line-box diagnostics in the browser, emits JSON, and exits nonzero on failed items.

**Tech Stack:** Node.js, Playwright, existing `visual_compare.parseArgs` and `targetToUrl` helpers.

---

### Task 1: Failing Text Visibility Test

**Files:**
- Create: `scripts/test_visual_text_visibility_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a temporary HTML fixture with:

- `#visible`: normal text
- `#hidden`: `display:none`
- `#clipped-wrap #clipped`: overflow-hidden container that clips text
- `#covered`: text covered by an absolute overlay
- `#low-contrast`: text with poor contrast against white

Create manifests:

```json
{
  "texts": [
    { "id": "visible", "selector": "#visible", "text": "Visible copy", "minContrast": 4.5 }
  ]
}
```

and:

```json
{
  "texts": [
    { "id": "hidden", "selector": "#hidden", "text": "Hidden copy" },
    { "id": "clipped", "selector": "#clipped", "text": "Clipped copy" },
    { "id": "covered", "selector": "#covered", "text": "Covered copy" },
    { "id": "low-contrast", "selector": "#low-contrast", "text": "Low contrast copy", "minContrast": 4.5 }
  ]
}
```

Assert the visible manifest exits `0`, writes output JSON with `ok: true`, and reports `lineBoxCount >= 1`.

Assert the failing manifest exits nonzero and stderr contains `hidden`, `clipped`, `covered`, and `low-contrast`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_text_visibility_check.js`

Expected: FAIL because `scripts/visual_text_visibility_check.js` does not exist.

- [ ] **Step 3: Wire test into package script**

Add `&& node scripts/test_visual_text_visibility_check.js` after `test_visual_readiness_report.js`.

### Task 2: Implement Text Visibility Checker

**Files:**
- Create: `scripts/visual_text_visibility_check.js`

- [ ] **Step 1: Implement CLI parsing**

Use `parseArgs` from `visual_compare.js`. Require `--target` and `--manifest`. Accept `--output`, `--width`, and `--height`.

- [ ] **Step 2: Implement manifest parsing**

Accept either an array or `{ "texts": [...] }`. Each item must have `id` and either `selector` or `text`.

- [ ] **Step 3: Implement browser diagnostics**

In the page, find each element by selector or normalized text match. For each item, report:

- `exists`
- `textMatches`
- `hidden`
- `hasNonzeroRect`
- `clipped`
- `covered`
- `contrast`
- `lineBoxCount`
- `ok`
- `failures[]`

- [ ] **Step 4: Implement contrast estimation**

Use computed text color and nearest non-transparent ancestor background, defaulting to white. Compute WCAG contrast ratio. If `minContrast` is set and contrast is lower, fail the item.

- [ ] **Step 5: Emit summary and fail on diagnostics**

Emit:

```json
{
  "ok": false,
  "target": "...",
  "manifest": "...",
  "width": 240,
  "height": 160,
  "passed": 1,
  "failed": 4,
  "items": []
}
```

Write the same JSON to `--output` when provided. Stderr should include one line per failed item, such as `covered: covered by #overlay`.

- [ ] **Step 6: Run targeted verification**

Run: `node scripts/test_visual_text_visibility_check.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_text_visibility_check.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_text_visibility_check.js`

- [ ] **Step 1: Add content test guards**

Require README and SKILL content to mention `scripts/visual_text_visibility_check.js` and `--manifest text-visibility.json`.

- [ ] **Step 2: Update docs**

Document the checker as the required pre-OCR DOM visibility audit for text-heavy pages.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add package.json SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_text_visibility_check.js scripts/visual_text_visibility_check.js docs/superpowers/specs/2026-05-30-text-visibility-checker-design.md docs/superpowers/plans/2026-05-30-text-visibility-checker.md
git commit -m "feat: add text visibility checker"
git push
```
