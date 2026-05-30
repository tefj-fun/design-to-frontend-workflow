# Region Manifest Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make component-region local comparison a first-class feature of the visual comparison script.

**Architecture:** Extend `scripts/visual_compare.js` with a `--region-manifest` option that accepts named component boxes, validates their geometry, crops each box from the reference and candidate screenshots, and emits per-region mismatch diagnostics alongside the existing full-page and masked UI scores. Keep the implementation in the existing script because it already owns pixelmatch, image loading, mask validation, and summary JSON.

**Tech Stack:** Node.js, Sharp, PNGJS, Pixelmatch, built-in `node:assert/strict`, `spawnSync`.

---

### Task 1: Region Manifest Validation

**Files:**
- Modify: `scripts/test_visual_compare.js`
- Modify: `scripts/visual_compare.js`

- [ ] **Step 1: Write the failing validation test**

Add a temporary `region-manifest.json` with a region extending outside the `2x1` fixture image:

```js
fs.writeFileSync(badRegionManifest, JSON.stringify({
  regions: [
    { id: "bad-button", x: 1, y: 0, width: 2, height: 1, role: "button" },
  ],
}, null, 2));
```

Assert the CLI exits nonzero and reports `Region bad-button must stay within image bounds`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_compare.js`

Expected: FAIL because `--region-manifest` is not supported yet.

- [ ] **Step 3: Implement validation**

Add `readRegionManifest()` and `normalizeRegionManifest()` modeled after mask validation, but allow intentional overlap because component regions may include parent/child comparisons. Require `id`, finite non-negative `x/y`, positive `width/height`, and in-bounds geometry.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test_visual_compare.js`

Expected: PASS.

### Task 2: Region Crop Scoring

**Files:**
- Modify: `scripts/test_visual_compare.js`
- Modify: `scripts/visual_compare.js`

- [ ] **Step 1: Write the failing scoring test**

Add a valid manifest with two one-pixel regions:

```js
fs.writeFileSync(validRegionManifest, JSON.stringify({
  regions: [
    { id: "left-cell", x: 0, y: 0, width: 1, height: 1, role: "stable" },
    { id: "right-button", x: 1, y: 0, width: 1, height: 1, role: "button", state: "default" },
  ],
}, null, 2));
```

Assert the summary includes:

```js
assert.equal(regionSummary.regionMismatch.length, 2);
assert.equal(regionSummary.regionMismatch[0].id, "left-cell");
assert.equal(regionSummary.regionMismatch[0].mismatchPercent, 0);
assert.equal(regionSummary.regionMismatch[1].id, "right-button");
assert.equal(regionSummary.regionMismatch[1].mismatchPercent, 100);
assert.equal(regionSummary.regionGeometry[1].centerDelta, 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_compare.js`

Expected: FAIL because validated regions are not scored yet.

- [ ] **Step 3: Implement crop scoring**

Add `scoreRegionCrop()` that loops pixels inside each normalized box and compares only that crop. Emit `regionMismatch[]`, `regionGeometry[]`, and `localCropMismatch` for the worst region. Include `regionCount` in the `sanity` block.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test_visual_compare.js`

Expected: PASS.

### Task 3: Verification, Sync, Commit

**Files:**
- Modify: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/visual_compare.js`
- Modify: `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/test_visual_compare.js`

- [ ] **Step 1: Run targeted verification**

Run: `node scripts/test_visual_compare.js`

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: every skill content and visual tooling test passes.

- [ ] **Step 3: Mirror installed skill files**

Copy the updated public repo script/test into `/Users/josephtsao/.codex/skills/design-to-frontend-workflow/scripts/` and verify with `cmp -s`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add scripts/visual_compare.js scripts/test_visual_compare.js docs/superpowers/plans/2026-05-30-region-manifest-compare.md
git commit -m "feat: add region manifest visual diagnostics"
git push
```
