#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-workflow-fixture-test-"));
const output = path.join(tmp, "workflow-summary.json");
const script = path.resolve(__dirname, "visual_workflow_fixture_check.js");

const result = spawnSync(process.execPath, [
  script,
  "--output",
  output,
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(result.status, 0, result.stderr || result.stdout);
assert.equal(fs.existsSync(output), true);

const summary = JSON.parse(result.stdout);
const writtenSummary = JSON.parse(fs.readFileSync(output, "utf8"));
assert.equal(summary.ok, true);
assert.equal(writtenSummary.ok, true);

for (const key of [
  "sourceOfTruth",
  "preflight",
  "designSystemCensus",
  "renderCapture",
  "visualCompare",
  "textVisibility",
  "ocr",
  "interactions",
  "readiness",
]) {
  assert.equal(summary.evidence[key].ok, true, `${key} evidence should pass`);
}

for (const [name, artifactPath] of Object.entries(summary.artifacts)) {
  assert.equal(fs.existsSync(artifactPath), true, `${name} artifact should exist at ${artifactPath}`);
}

const readinessChecks = summary.evidence.readiness.checks.map((check) => check.name);
for (const checkName of [
  "artifact-freshness",
  "evidence-freshness",
  "text-visibility-summary",
  "ocr-summary",
  "interaction-summary",
  "region-diagnostics",
]) {
  assert.ok(readinessChecks.includes(checkName), `readiness checks should include ${checkName}`);
}

assert.equal(summary.evidence.visualCompare.summary.sanity.dimensionsMatch, true);
assert.equal(summary.evidence.preflight.summary.ok, true);
assert.equal(summary.evidence.preflight.summary.checks.some((check) => check.name === "image-dimensions"), true);
assert.equal(summary.evidence.visualCompare.summary.sanity.scoreInvariantOk, true);
assert.ok(summary.evidence.visualCompare.summary.regionMismatch.length >= 1);
assert.equal(summary.evidence.textVisibility.summary.ok, true);
assert.equal(summary.evidence.ocr.summary.missingReferenceLines, 0);
assert.equal(summary.evidence.interactions.summary.ok, true);

console.log("visual_workflow_fixture_check test passed");
