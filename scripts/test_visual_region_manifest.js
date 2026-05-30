#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-region-manifest-test-"));
const html = path.join(tmp, "fixture.html");
const source = path.join(tmp, "source.json");
const output = path.join(tmp, "regions.json");

fs.writeFileSync(html, [
  "<!doctype html>",
  "<html>",
  "<head>",
  "<style>",
  "html,body{margin:0;width:200px;height:100px;}",
  "#primary{position:absolute;left:10px;top:8px;width:80px;height:30px;padding:0;border:0;}",
  "#status{position:absolute;left:120px;top:20px;width:50px;height:20px;}",
  "</style>",
  "</head>",
  "<body>",
  "<button id=\"primary\">Start</button>",
  "<div id=\"status\">Ready</div>",
  "</body>",
  "</html>",
].join(""));

fs.writeFileSync(source, JSON.stringify({
  regions: [
    { id: "primary-cta", selector: "#primary", role: "button", state: "default", padding: 2 },
    { id: "status-label", text: "Ready", match: "exact", role: "label" },
  ],
}, null, 2));

const script = path.resolve(__dirname, "visual_region_manifest.js");
const result = spawnSync(process.execPath, [
  script,
  "--target",
  html,
  "--source",
  source,
  "--output",
  output,
  "--width",
  "200",
  "--height",
  "100",
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(result.status, 0, result.stderr || result.stdout);
assert.equal(fs.existsSync(output), true);

const summary = JSON.parse(result.stdout);
const manifest = JSON.parse(fs.readFileSync(output, "utf8"));

assert.equal(summary.output, output);
assert.equal(summary.regionCount, 2);
assert.equal(manifest.width, 200);
assert.equal(manifest.height, 100);
assert.equal(manifest.regions.length, 2);

const button = manifest.regions[0];
assert.equal(button.id, "primary-cta");
assert.equal(button.role, "button");
assert.equal(button.state, "default");
assert.equal(button.selector, "#primary");
assert.equal(button.x, 8);
assert.equal(button.y, 6);
assert.equal(button.width, 84);
assert.equal(button.height, 34);
assert.equal(button.source, "selector");

const label = manifest.regions[1];
assert.equal(label.id, "status-label");
assert.equal(label.role, "label");
assert.equal(label.text, "Ready");
assert.equal(label.x, 120);
assert.equal(label.y, 20);
assert.equal(label.width, 50);
assert.equal(label.height, 20);
assert.equal(label.source, "text");

console.log("visual_region_manifest test passed");
