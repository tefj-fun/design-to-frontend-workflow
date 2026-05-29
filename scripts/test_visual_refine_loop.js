#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

function writeSolidPng(filePath, width, height, rgba) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    png.data[offset] = rgba[0];
    png.data[offset + 1] = rgba[1];
    png.data[offset + 2] = rgba[2];
    png.data[offset + 3] = rgba[3];
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-refine-loop-test-"));
const reference = path.join(tmp, "reference.png");
const template = path.join(tmp, "template.html");
const variants = path.join(tmp, "variants.json");
const outputDir = path.join(tmp, "output");

writeSolidPng(reference, 8, 8, [255, 0, 0, 255]);
fs.writeFileSync(template, [
  "<!doctype html>",
  "<html>",
  "<head><style>html,body{margin:0;width:100%;height:100%;background:{{bg}};}</style></head>",
  "<body></body>",
  "</html>",
].join(""));
fs.writeFileSync(variants, JSON.stringify({
  baseline: { bg: "rgb(0, 0, 255)" },
  iterations: [
    [
      { label: "green-regression", values: { bg: "rgb(0, 255, 0)" } },
      { label: "red-match", values: { bg: "rgb(255, 0, 0)" } }
    ]
  ]
}, null, 2));

const script = path.resolve(__dirname, "visual_refine_loop.js");
const result = spawnSync(process.execPath, [
  script,
  "--reference",
  reference,
  "--template",
  template,
  "--variants",
  variants,
  "--output-dir",
  outputDir,
  "--width",
  "8",
  "--height",
  "8",
  "--threshold",
  "0.1",
  "--max-iterations",
  "2",
  "--grid-cols",
  "2",
  "--grid-rows",
  "2",
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const summary = JSON.parse(result.stdout);
assert.equal(summary.accepted.length, 1);
assert.equal(summary.accepted[0].label, "red-match");
assert.equal(summary.final.mismatchedPixels, 0);
assert.equal(summary.final.mismatchPercent, 0);
assert.equal(summary.final.values.bg, "rgb(255, 0, 0)");
assert.equal(fs.existsSync(path.join(outputDir, "history.json")), true);
assert.equal(fs.existsSync(summary.final.html), true);
assert.equal(fs.existsSync(summary.final.rendered), true);
assert.equal(fs.existsSync(summary.final.diff), true);
assert.equal(summary.final.regions.length, 4);

console.log("visual_refine_loop test passed");
