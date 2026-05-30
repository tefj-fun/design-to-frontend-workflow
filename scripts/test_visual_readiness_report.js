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

function writeLedger(filePath) {
  fs.writeFileSync(filePath, [
    "# Visual Workflow Ledger",
    "",
    "## Active Page Lock",
    "",
    "- Active page/route/state: Dashboard",
    "- Why this page is active: release target",
    "- Entry score: 4%",
    "- Current score: 1.5%",
    "- Best-known score: 1.5%",
    "- Exit condition: uiMaskedMismatch < 3%",
    "- Switch reason, if changing pages:",
    "",
    "## Checkpoints",
    "",
    "| Time | Active page | Current/best score | Accepted changes | Rejected hypotheses | Blocker class | Next patch | Gate feasible? |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| 12:00 | Dashboard | 1.5/1.5 | button fix | none | local-component | final verify | yes |",
    "",
  ].join("\n"));
}

function writeScore(scorePath, paths, uiMaskedMismatch = 1.5) {
  fs.writeFileSync(scorePath, JSON.stringify({
    reference: paths.reference,
    candidate: paths.candidate,
    diff: paths.diff,
    width: 2,
    height: 1,
    fullPageMismatch: 2.5,
    uiMaskedMismatch,
    sanity: {
      dimensionsMatch: true,
      scoreInvariantOk: true,
      regionCount: 1,
    },
    regionMismatch: [
      { id: "primary-button", mismatchPercent: 0.5 },
    ],
  }, null, 2));
}

function runReadiness(script, paths) {
  return spawnSync(process.execPath, [
    script,
    "--score",
    paths.score,
    "--newer-than",
    paths.source,
    "--ledger",
    paths.ledger,
    "--interaction-summary",
    paths.interactionSummary,
    "--ocr-summary",
    paths.ocrSummary,
    "--max-ui-mismatch",
    "3",
    "--require-regions",
  ], {
    encoding: "utf8",
    env: process.env,
  });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-readiness-report-test-"));
const paths = {
  reference: path.join(tmp, "reference.png"),
  candidate: path.join(tmp, "candidate.png"),
  diff: path.join(tmp, "diff.png"),
  source: path.join(tmp, "source.html"),
  score: path.join(tmp, "score.json"),
  ledger: path.join(tmp, "visual-workflow-ledger.md"),
  interactionSummary: path.join(tmp, "interaction-summary.json"),
  ocrSummary: path.join(tmp, "ocr-summary.json"),
};

const sourceTime = new Date("2026-05-30T12:00:00.000Z");
const freshTime = new Date("2026-05-30T12:05:00.000Z");
const staleTime = new Date("2026-05-30T11:55:00.000Z");

for (const filePath of [paths.reference, paths.candidate, paths.diff, paths.source]) {
  fs.writeFileSync(filePath, filePath);
}
writeLedger(paths.ledger);
fs.writeFileSync(paths.interactionSummary, JSON.stringify({ ok: true, passed: 3, failed: 0 }, null, 2));
fs.writeFileSync(paths.ocrSummary, JSON.stringify({ ok: true, similarity: 0.93 }, null, 2));
writeScore(paths.score, paths);

touch(paths.source, sourceTime);
for (const filePath of [
  paths.reference,
  paths.candidate,
  paths.diff,
  paths.score,
  paths.ledger,
  paths.interactionSummary,
  paths.ocrSummary,
]) {
  touch(filePath, freshTime);
}

const script = path.resolve(__dirname, "visual_readiness_report.js");
const passing = runReadiness(script, paths);

assert.equal(passing.status, 0, passing.stderr || passing.stdout);
const passingSummary = JSON.parse(passing.stdout);
assert.equal(passingSummary.ok, true);
assert.deepEqual(
  passingSummary.checks.map((check) => check.name),
  [
    "artifact-freshness",
    "score-sanity",
    "threshold",
    "ledger",
    "interaction-summary",
    "ocr-summary",
    "region-diagnostics",
  ],
);

writeScore(paths.score, paths, 4.5);
touch(paths.score, freshTime);

const thresholdFailure = runReadiness(script, paths);
assert.notEqual(thresholdFailure.status, 0);
assert.match(thresholdFailure.stderr, /threshold/i);

writeScore(paths.score, paths, 1.5);
touch(paths.score, freshTime);
touch(paths.diff, staleTime);

const staleFailure = runReadiness(script, paths);
assert.notEqual(staleFailure.status, 0);
assert.match(staleFailure.stderr, /artifact-freshness/i);

console.log("visual_readiness_report test passed");
