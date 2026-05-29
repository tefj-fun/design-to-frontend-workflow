#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

function writePng(filePath, width, height, rgba) {
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-diagnostics-test-"));
const referenceImage = path.join(tmp, "reference.png");
const referenceHtml = path.join(tmp, "reference.html");
const candidateHtml = path.join(tmp, "candidate.html");
const rendered = path.join(tmp, "candidate.png");
const diff = path.join(tmp, "diff.png");

writePng(referenceImage, 320, 180, [255, 255, 255, 255]);

const sharedCss = `
  body { margin: 0; font-family: Arial, sans-serif; color: rgb(10, 20, 30); }
  main { width: 240px; margin: 20px auto; }
  h1 { margin: 0 0 12px; font-size: 24px; color: rgb(10, 20, 30); }
  p { margin: 0 0 16px; font-size: 16px; }
  a { display: inline-block; padding: 8px 12px; color: rgb(255, 255, 255); background: rgb(50, 60, 70); text-decoration: none; }
`;

fs.writeFileSync(referenceHtml, `<!doctype html><html><head><style>${sharedCss}</style></head><body><main><h1>Hello World</h1><p>Diagnostic scoring works.</p><a href="#">Continue</a></main></body></html>`);
fs.writeFileSync(candidateHtml, `<!doctype html><html><head><style>${sharedCss} main { margin-top: 22px; }</style></head><body><main><h1>Hello World</h1><p>Diagnostic scoring works.</p><a href="#">Continue</a></main></body></html>`);

const script = path.resolve(__dirname, "visual_compare.js");
const result = spawnSync(process.execPath, [
  script,
  "--reference",
  referenceImage,
  "--reference-html",
  referenceHtml,
  "--target",
  candidateHtml,
  "--rendered",
  rendered,
  "--diff",
  diff,
  "--width",
  "320",
  "--height",
  "180",
  "--threshold",
  "0.1",
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const summary = JSON.parse(result.stdout);
assert.ok(summary.diagnostics, "expected diagnostics");
assert.equal(summary.diagnostics.text.similarity, 1);
assert.ok(summary.diagnostics.layout.matchedBlocks >= 3, "expected at least 3 matched blocks");
assert.ok(summary.diagnostics.layout.score > 0.9, `layout score ${summary.diagnostics.layout.score}`);
assert.ok(summary.diagnostics.color.score > 0.98, `color score ${summary.diagnostics.color.score}`);
assert.equal(fs.existsSync(rendered), true);
assert.equal(fs.existsSync(diff), true);

console.log("visual_diagnostics test passed");
