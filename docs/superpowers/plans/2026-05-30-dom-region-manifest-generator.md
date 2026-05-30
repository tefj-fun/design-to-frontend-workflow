# DOM Region Manifest Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small utility that generates `visual_compare.js --region-manifest` files from live DOM selectors or visible text in a rendered page.

**Architecture:** Create `scripts/visual_region_manifest.js` as a Playwright-backed CLI. It reads a source JSON file containing region ids and either `selector` or `text`, captures each element's viewport bounding box at the requested size, applies optional crop padding, clamps boxes to viewport bounds, and writes a normalized `{ "regions": [...] }` manifest compatible with `visual_compare.js`.

**Tech Stack:** Node.js, Playwright, built-in `node:assert/strict`, `spawnSync`.

---

### Task 1: Failing Generator Test

**Files:**
- Create: `scripts/test_visual_region_manifest.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a temp HTML fixture with a button and status label at deterministic absolute positions. Create a source manifest:

```json
{
  "regions": [
    { "id": "primary-cta", "selector": "#primary", "role": "button", "state": "default", "padding": 2 },
    { "id": "status-label", "text": "Ready", "match": "exact", "role": "label" }
  ]
}
```

Run:

```bash
node scripts/visual_region_manifest.js --target fixture.html --source source.json --output regions.json --width 200 --height 100
```

Assert the output contains two regions and that the button box includes padding.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_region_manifest.js`

Expected: FAIL because `scripts/visual_region_manifest.js` does not exist.

- [ ] **Step 3: Wire the test into `npm test` after the comparer test**

Add `&& node scripts/test_visual_region_manifest.js` to the package test script.

### Task 2: Generator Implementation

**Files:**
- Create: `scripts/visual_region_manifest.js`

- [ ] **Step 1: Implement argument parsing and manifest input**

Reuse `parseArgs`, `parsePositiveInt`, and `targetToUrl` from `visual_compare.js`. Require `--target`, `--source`, and `--output`.

- [ ] **Step 2: Implement selector and text resolution**

Use Playwright to open the target at `deviceScaleFactor: 1`. For selector regions, query `document.querySelector`. For text regions, find visible elements whose normalized text matches exactly by default or includes the requested text when `match` is `"contains"`.

- [ ] **Step 3: Implement box normalization**

Read `getBoundingClientRect()`, apply region-level `padding` or side-specific padding, clamp to viewport bounds, round coordinates to two decimals, and preserve metadata fields `id`, `role`, `state`, `selector`, `text`, and `viewport`.

- [ ] **Step 4: Run targeted verification**

Run: `node scripts/test_visual_region_manifest.js`

Expected: PASS.

### Task 3: Docs, Sync, Commit

**Files:**
- Modify: `SKILL.md`
- Modify: `README.md`
- Modify: `scripts/test_skill_content.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_region_manifest.js`
- Copy to: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_region_manifest.js`

- [ ] **Step 1: Add content tests**

Require README and SKILL content to mention `scripts/visual_region_manifest.js` and `--region-manifest`.

- [ ] **Step 2: Update docs**

Document how to generate `regions.json` and then pass it to `visual_compare.js`.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 4: Mirror installed skill files and verify**

Copy updated files into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow` and verify matching with `cmp -s`.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add package.json SKILL.md README.md scripts/test_skill_content.js scripts/test_visual_region_manifest.js scripts/visual_region_manifest.js docs/superpowers/plans/2026-05-30-dom-region-manifest-generator.md
git commit -m "feat: generate region manifests from DOM"
git push
```
