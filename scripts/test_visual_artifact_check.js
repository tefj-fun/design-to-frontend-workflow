#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function touch(filePath, date) {
  fs.closeSync(fs.openSync(filePath, "a"));
  fs.utimesSync(filePath, date, date);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-artifact-check-test-"));
const reference = path.join(tmp, "reference.png");
const candidate = path.join(tmp, "candidate.png");
const diff = path.join(tmp, "diff.png");
const rendered = path.join(tmp, "rendered.png");
const source = path.join(tmp, "source.html");
const score = path.join(tmp, "score.json");

const sourceTime = new Date("2026-05-30T12:00:00.000Z");
const freshTime = new Date("2026-05-30T12:05:00.000Z");
const staleTime = new Date("2026-05-30T11:55:00.000Z");

for (const filePath of [reference, candidate, diff, rendered, source]) {
  fs.writeFileSync(filePath, filePath);
}

fs.writeFileSync(score, JSON.stringify({
  reference,
  candidate,
  diff,
  rendered,
  width: 2,
  height: 1,
  mismatchPercent: 50,
}, null, 2));

touch(source, sourceTime);
for (const filePath of [reference, candidate, diff, rendered, score]) {
  touch(filePath, freshTime);
}

const script = path.resolve(__dirname, "visual_artifact_check.js");
const fresh = spawnSync(process.execPath, [
  script,
  "--score",
  score,
  "--newer-than",
  source,
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(fresh.status, 0, fresh.stderr || fresh.stdout);
const freshSummary = JSON.parse(fresh.stdout);
assert.equal(freshSummary.ok, true);
assert.equal(freshSummary.artifacts.length, 5);
assert.equal(freshSummary.artifacts.every((artifact) => artifact.exists && !artifact.stale), true);

touch(diff, staleTime);

const stale = spawnSync(process.execPath, [
  script,
  "--score",
  score,
  "--newer-than",
  source,
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(stale.status, 0);
assert.match(stale.stderr, /diff is stale/i);

console.log("visual_artifact_check test passed");
