#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

function writePng(filePath, pixels) {
  const png = new PNG({ width: 2, height: 1 });
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-compare-test-"));
const reference = path.join(tmp, "reference.png");
const candidate = path.join(tmp, "candidate.png");
const diff = path.join(tmp, "diff.png");

writePng(reference, [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
]);
writePng(candidate, [
  [0, 0, 0, 255],
  [255, 0, 0, 255],
]);

const script = path.resolve(__dirname, "visual_compare.js");
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

console.log("visual_compare test passed");
