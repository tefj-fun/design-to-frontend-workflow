#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-ocr-compare-test-"));
const referenceHtml = path.join(tmp, "reference.html");
const candidateHtml = path.join(tmp, "candidate.html");
const referencePng = path.join(tmp, "reference.png");
const candidatePng = path.join(tmp, "candidate.png");
const script = path.resolve(__dirname, "visual_ocr_compare.js");
const compareScript = path.resolve(__dirname, "visual_compare.js");

function writeHtml(filePath, top) {
  fs.writeFileSync(filePath, `<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; background: white; font-family: Arial, sans-serif; }
      .text { position: absolute; left: 40px; top: ${top}px; font-size: 42px; font-weight: 700; color: black; }
    </style>
  </head>
  <body><div class="text">Hello World</div></body>
</html>`);
}

function render(target, rendered) {
  const result = spawnSync(process.execPath, [
    compareScript,
    "--reference",
    referencePng,
    "--target",
    target,
    "--rendered",
    rendered,
    "--diff",
    path.join(tmp, `${path.basename(rendered)}-diff.png`),
    "--width",
    "360",
    "--height",
    "180",
    "--threshold",
    "0.1",
  ], { encoding: "utf8", env: process.env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

writeHtml(referenceHtml, 30);
writeHtml(candidateHtml, 70);
fs.writeFileSync(referencePng, Buffer.alloc(1));
render(referenceHtml, referencePng);
render(candidateHtml, candidatePng);

const result = spawnSync(process.execPath, [
  script,
  "--reference",
  referencePng,
  "--candidate",
  candidatePng,
], { encoding: "utf8", env: process.env });

assert.equal(result.status, 0, result.stderr || result.stdout);
const summary = JSON.parse(result.stdout);
assert.equal(summary.matchedLines, 1);
assert.equal(summary.missingReferenceLines, 0);
assert.equal(summary.missingCandidateLines, 0);
assert.ok(summary.maxAbsTopDelta >= 30, `expected visible y delta, got ${summary.maxAbsTopDelta}`);
assert.ok(summary.worstLineDeltas[0].text.includes("Hello"));

console.log("visual_ocr_compare test passed");
