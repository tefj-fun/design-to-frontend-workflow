#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-interaction-check-test-"));
const html = path.join(tmp, "fixture.html");
const manifest = path.join(tmp, "interactions.json");
const brokenManifest = path.join(tmp, "broken-interactions.json");
const output = path.join(tmp, "summary.json");

fs.writeFileSync(html, [
  "<!doctype html>",
  "<html>",
  "<head>",
  "<style>",
  "html,body{margin:0;width:240px;height:160px;}",
  "#open{background:rgb(0, 0, 255);color:white;}",
  "#open:hover{background:rgb(0, 128, 0);}",
  "#modal{display:none;position:absolute;left:20px;top:60px;padding:8px;border:1px solid #111;}",
  "#modal[data-open='true']{display:block;}",
  "</style>",
  "</head>",
  "<body>",
  "<button id=\"open\">Open modal</button>",
  "<input id=\"name\" aria-label=\"Name\" />",
  "<div id=\"modal\">Modal ready</div>",
  "<script>",
  "document.getElementById('open').addEventListener('click', () => {",
  "  document.getElementById('modal').dataset.open = 'true';",
  "});",
  "</script>",
  "</body>",
  "</html>",
].join(""));

fs.writeFileSync(manifest, JSON.stringify({
  states: [
    {
      id: "open-modal",
      actions: [{ type: "click", selector: "#open" }],
      assertions: [
        { type: "visible", selector: "#modal" },
        { type: "text", selector: "#modal", contains: "Modal ready" },
      ],
    },
    {
      id: "focus-name",
      actions: [{ type: "focus", selector: "#name" }],
      assertions: [{ type: "focused", selector: "#name" }],
    },
    {
      id: "hover-open",
      actions: [{ type: "hover", selector: "#open" }],
      assertions: [
        { type: "css", selector: "#open", property: "backgroundColor", equals: "rgb(0, 128, 0)" },
      ],
    },
  ],
}, null, 2));

fs.writeFileSync(brokenManifest, JSON.stringify({
  states: [
    {
      id: "missing-modal",
      actions: [],
      assertions: [{ type: "visible", selector: "#does-not-exist" }],
    },
  ],
}, null, 2));

const script = path.resolve(__dirname, "visual_interaction_check.js");
const passing = spawnSync(process.execPath, [
  script,
  "--target",
  html,
  "--manifest",
  manifest,
  "--output",
  output,
  "--width",
  "240",
  "--height",
  "160",
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(passing.status, 0, passing.stderr || passing.stdout);
assert.equal(fs.existsSync(output), true);
const summary = JSON.parse(passing.stdout);
const writtenSummary = JSON.parse(fs.readFileSync(output, "utf8"));
assert.equal(summary.ok, true);
assert.equal(summary.passed, 3);
assert.equal(summary.failed, 0);
assert.deepEqual(summary.states.map((state) => state.id), ["open-modal", "focus-name", "hover-open"]);
assert.deepEqual(writtenSummary.states.map((state) => state.ok), [true, true, true]);

const broken = spawnSync(process.execPath, [
  script,
  "--target",
  html,
  "--manifest",
  brokenManifest,
  "--width",
  "240",
  "--height",
  "160",
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(broken.status, 0);
assert.match(broken.stderr, /missing-modal/);
assert.match(broken.stderr, /#does-not-exist/);

console.log("visual_interaction_check test passed");
