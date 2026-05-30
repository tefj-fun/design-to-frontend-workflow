#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-text-visibility-test-"));
const html = path.join(tmp, "fixture.html");
const passingManifest = path.join(tmp, "passing-text-visibility.json");
const failingManifest = path.join(tmp, "failing-text-visibility.json");
const output = path.join(tmp, "text-visibility-summary.json");

fs.writeFileSync(html, [
  "<!doctype html>",
  "<html>",
  "<head>",
  "<style>",
  "html,body{margin:0;width:260px;height:180px;background:white;color:black;font:16px/20px Arial,sans-serif;}",
  "#visible{position:absolute;left:10px;top:10px;color:#111;background:#fff;}",
  "#hidden{display:none;}",
  "#clip-wrap{position:absolute;left:10px;top:48px;width:80px;height:18px;overflow:hidden;background:white;}",
  "#clipped{position:absolute;left:0;top:24px;color:#111;background:white;}",
  "#covered{position:absolute;left:10px;top:88px;width:128px;height:24px;color:#111;background:white;}",
  "#cover{position:absolute;left:8px;top:86px;width:136px;height:30px;background:rgba(255,255,255,0.98);z-index:2;}",
  "#low-contrast{position:absolute;left:10px;top:132px;color:rgb(238,238,238);background:white;}",
  "</style>",
  "</head>",
  "<body>",
  "<div id=\"visible\">Visible copy</div>",
  "<div id=\"hidden\">Hidden copy</div>",
  "<div id=\"clip-wrap\"><div id=\"clipped\">Clipped copy</div></div>",
  "<div id=\"covered\">Covered copy</div><div id=\"cover\"></div>",
  "<div id=\"low-contrast\">Low contrast copy</div>",
  "</body>",
  "</html>",
].join(""));

fs.writeFileSync(passingManifest, JSON.stringify({
  texts: [
    {
      id: "visible",
      selector: "#visible",
      text: "Visible copy",
      minContrast: 4.5,
      expectedLineCount: 1,
    },
  ],
}, null, 2));

fs.writeFileSync(failingManifest, JSON.stringify({
  texts: [
    { id: "hidden", selector: "#hidden", text: "Hidden copy" },
    { id: "clipped", selector: "#clipped", text: "Clipped copy" },
    { id: "covered", selector: "#covered", text: "Covered copy" },
    {
      id: "low-contrast",
      selector: "#low-contrast",
      text: "Low contrast copy",
      minContrast: 4.5,
    },
  ],
}, null, 2));

const script = path.resolve(__dirname, "visual_text_visibility_check.js");
const passing = spawnSync(process.execPath, [
  script,
  "--target",
  html,
  "--manifest",
  passingManifest,
  "--output",
  output,
  "--width",
  "260",
  "--height",
  "180",
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(passing.status, 0, passing.stderr || passing.stdout);
assert.equal(fs.existsSync(output), true);
const summary = JSON.parse(passing.stdout);
const writtenSummary = JSON.parse(fs.readFileSync(output, "utf8"));
assert.equal(summary.ok, true);
assert.equal(summary.passed, 1);
assert.equal(summary.failed, 0);
assert.equal(summary.items[0].id, "visible");
assert.equal(summary.items[0].lineBoxCount >= 1, true);
assert.deepEqual(writtenSummary.items.map((item) => item.ok), [true]);

const failing = spawnSync(process.execPath, [
  script,
  "--target",
  html,
  "--manifest",
  failingManifest,
  "--width",
  "260",
  "--height",
  "180",
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(failing.status, 0);
assert.match(failing.stderr, /hidden/);
assert.match(failing.stderr, /clipped/);
assert.match(failing.stderr, /covered/);
assert.match(failing.stderr, /low-contrast/);

console.log("visual_text_visibility_check test passed");
