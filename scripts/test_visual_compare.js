#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

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

function writePng(filePath, pixels) {
  writeSizedPng(filePath, 2, 1, pixels);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-compare-test-"));
const reference = path.join(tmp, "reference.png");
const candidate = path.join(tmp, "candidate.png");
const diff = path.join(tmp, "diff.png");
const wrongSizeCandidate = path.join(tmp, "candidate-3x1.png");
const maskManifest = path.join(tmp, "mask-manifest.json");
const validMaskManifest = path.join(tmp, "valid-mask-manifest.json");
const badRegionManifest = path.join(tmp, "bad-region-manifest.json");
const validRegionManifest = path.join(tmp, "valid-region-manifest.json");
const script = path.resolve(__dirname, "visual_compare.js");

writePng(reference, [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
]);
writePng(candidate, [
  [0, 0, 0, 255],
  [255, 0, 0, 255],
]);
writeSizedPng(wrongSizeCandidate, 3, 1, [
  [0, 0, 0, 255],
  [255, 0, 0, 255],
  [255, 255, 255, 255],
]);

const result = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--candidate",
  candidate,
  "--diff",
  diff,
  "--width",
  "2",
  "--height",
  "1",
  "--threshold",
  "0.1",
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const summary = JSON.parse(result.stdout);
assert.equal(summary.reference, reference);
assert.equal(summary.candidate, candidate);
assert.equal(summary.diff, diff);
assert.equal(summary.width, 2);
assert.equal(summary.height, 1);
assert.equal(summary.mismatchedPixels, 1);
assert.equal(summary.totalPixels, 2);
assert.equal(summary.mismatchPercent, 50);
assert.equal(fs.existsSync(diff), true);

const dimensionMismatch = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--candidate",
  wrongSizeCandidate,
  "--diff",
  path.join(tmp, "dimension-diff.png"),
  "--width",
  "2",
  "--height",
  "1",
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(dimensionMismatch.status, 0);
assert.match(dimensionMismatch.stderr, /dimensions must match/i);

fs.writeFileSync(maskManifest, JSON.stringify({
  masks: [
    { id: "bad-map", x: 1, y: 0, width: 2, height: 1, reason: "representative map" },
  ],
}, null, 2));

const invalidMask = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--candidate",
  candidate,
  "--diff",
  path.join(tmp, "masked-diff.png"),
  "--width",
  "2",
  "--height",
  "1",
  "--mask-manifest",
  maskManifest,
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(invalidMask.status, 0);
assert.match(invalidMask.stderr, /mask bad-map must stay within image bounds/i);

fs.writeFileSync(validMaskManifest, JSON.stringify({
  masks: [
    { id: "approved-raster", x: 1, y: 0, width: 1, height: 1, reason: "approved representative image pixel" },
  ],
}, null, 2));

const validMask = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--candidate",
  candidate,
  "--diff",
  path.join(tmp, "valid-masked-diff.png"),
  "--width",
  "2",
  "--height",
  "1",
  "--mask-manifest",
  validMaskManifest,
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(validMask.status, 0, validMask.stderr || validMask.stdout);
const maskedSummary = JSON.parse(validMask.stdout);
assert.equal(maskedSummary.mismatchedPixels, 1);
assert.equal(maskedSummary.mismatchPercent, 50);
assert.equal(maskedSummary.fullPageMismatch, 50);
assert.equal(maskedSummary.uiMaskedMismatchedPixels, 0);
assert.equal(maskedSummary.uiMaskedMismatch, 0);
assert.equal(maskedSummary.sanity.maskCount, 1);
assert.equal(maskedSummary.sanity.maskedPixelCount, 1);
assert.equal(maskedSummary.sanity.maskedPixelRatio, 0.5);
assert.equal(maskedSummary.sanity.scoreInvariantOk, true);

fs.writeFileSync(badRegionManifest, JSON.stringify({
  regions: [
    { id: "bad-button", x: 1, y: 0, width: 2, height: 1, role: "button" },
  ],
}, null, 2));

const invalidRegion = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--candidate",
  candidate,
  "--diff",
  path.join(tmp, "bad-region-diff.png"),
  "--width",
  "2",
  "--height",
  "1",
  "--region-manifest",
  badRegionManifest,
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(invalidRegion.status, 0);
assert.match(invalidRegion.stderr, /region bad-button must stay within image bounds/i);

fs.writeFileSync(validRegionManifest, JSON.stringify({
  regions: [
    { id: "left-cell", x: 0, y: 0, width: 1, height: 1, role: "stable" },
    { id: "right-button", x: 1, y: 0, width: 1, height: 1, role: "button", state: "default" },
  ],
}, null, 2));

const validRegion = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--candidate",
  candidate,
  "--diff",
  path.join(tmp, "valid-region-diff.png"),
  "--width",
  "2",
  "--height",
  "1",
  "--region-manifest",
  validRegionManifest,
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(validRegion.status, 0, validRegion.stderr || validRegion.stdout);
const regionSummary = JSON.parse(validRegion.stdout);
assert.equal(regionSummary.sanity.regionCount, 2);
assert.equal(regionSummary.regionMismatch.length, 2);
assert.equal(regionSummary.regionMismatch[0].id, "left-cell");
assert.equal(regionSummary.regionMismatch[0].mismatchPercent, 0);
assert.equal(regionSummary.regionMismatch[1].id, "right-button");
assert.equal(regionSummary.regionMismatch[1].mismatchPercent, 100);
assert.equal(regionSummary.regionGeometry.length, 2);
assert.equal(regionSummary.regionGeometry[1].id, "right-button");
assert.equal(regionSummary.regionGeometry[1].centerDelta, 0);
assert.equal(regionSummary.localCropMismatch.id, "right-button");
assert.equal(regionSummary.localCropMismatch.mismatchPercent, 100);

console.log("visual_compare test passed");
