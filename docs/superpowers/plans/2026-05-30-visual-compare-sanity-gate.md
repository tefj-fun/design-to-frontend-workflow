# Visual Compare Sanity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visual comparison script enforce the scoring sanity rules already documented in the design-to-frontend workflow skill.

**Architecture:** Keep the behavior local to `scripts/visual_compare.js`: validate input image dimensions before normalization, validate mask manifests before scoring, and emit a compact `sanity` block in the JSON summary. Extend `scripts/test_visual_compare.js` with red-green coverage for dimension mismatch and invalid masks.

**Tech Stack:** Node.js, Sharp, PNGJS, Pixelmatch, built-in `node:assert/strict`, `spawnSync`.

---

### Task 1: Dimension Sanity

**Files:**
- Modify: `scripts/test_visual_compare.js`
- Modify: `scripts/visual_compare.js`

- [ ] **Step 1: Write the failing dimension test**

Add helpers for custom PNG sizes and add a spawned CLI assertion that a `3x1` candidate compared against a `2x1` reference fails before resizing:

```js
function writeSizedPng(filePath, width, height, pixels) {
  const png = new PNG({ width, height });
  for (let i = 0; i < pixels.length; i += 1) {
    const offset = i * 4;
    const [r, g, b, a] = pixels[i];
    png.data[offset] = r;
    png.data[offset + 1] = g;
    png.data[offset + 2] = b;
    png.data[offset + 3] = a;
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_compare.js`

Expected: FAIL because `visual_compare.js` currently resizes both images instead of rejecting unequal source dimensions.

- [ ] **Step 3: Implement dimension validation**

Read Sharp metadata before normalization and throw an explicit error when reference/candidate source dimensions differ from each other or from requested `--width`/`--height`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test_visual_compare.js`

Expected: PASS.

### Task 2: Mask Manifest Sanity

**Files:**
- Modify: `scripts/test_visual_compare.js`
- Modify: `scripts/visual_compare.js`

- [ ] **Step 1: Write the failing mask test**

Create a temporary mask manifest with a box that extends outside the `2x1` image and assert the CLI exits nonzero with a mask bounds error:

```js
fs.writeFileSync(maskManifest, JSON.stringify({
  masks: [{ id: "bad-map", x: 1, y: 0, width: 2, height: 1, reason: "representative map" }],
}, null, 2));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_visual_compare.js`

Expected: FAIL because `--mask-manifest` is not yet supported by `visual_compare.js`.

- [ ] **Step 3: Implement mask validation and masked scoring**

Add `--mask-manifest` support. Validate JSON shape, finite non-negative `x/y`, positive `width/height`, in-bounds geometry, and compute `uiMaskedMismatch` by excluding approved mask pixels from the mismatch count while preserving `fullPageMismatch`.

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

Copy the updated public repo script/test into the installed skill folder and verify with `cmp -s`.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add scripts/visual_compare.js scripts/test_visual_compare.js docs/superpowers/plans/2026-05-30-visual-compare-sanity-gate.md
git commit -m "feat: enforce visual compare sanity checks"
git push
```
