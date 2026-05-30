#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function ledgerWithCheckpoints(checkpointRows, switchReason = "") {
  return [
    "# Visual Workflow Ledger",
    "",
    "## Active Page Lock",
    "",
    "- Active page/route/state: Dashboard",
    "- Why this page is active: release target",
    "- Entry score: 8%",
    "- Current score: 5%",
    "- Best-known score: 5%",
    "- Exit condition: uiMaskedMismatch < 3%",
    `- Switch reason, if changing pages: ${switchReason}`,
    "",
    "## Checkpoints",
    "",
    "| Time | Active page | Current/best score | Accepted changes | Rejected hypotheses | Blocker class | Next patch | Gate feasible? |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...checkpointRows,
    "",
  ].join("\n");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-ledger-check-test-"));
const validLedger = path.join(tmp, "valid-ledger.md");
const invalidSwitchLedger = path.join(tmp, "invalid-switch-ledger.md");
const validSwitchLedger = path.join(tmp, "valid-switch-ledger.md");
const script = path.resolve(__dirname, "visual_ledger_check.js");

fs.writeFileSync(validLedger, ledgerWithCheckpoints([
  "| 09:00 | Dashboard | 5/5 | button fix | spacing | local-component | cards | yes |",
  "| 10:00 | Dashboard | 4/4 | card fix | shadow | local-component | nav | yes |",
]));

fs.writeFileSync(invalidSwitchLedger, ledgerWithCheckpoints([
  "| 09:00 | Dashboard | 5/5 | button fix | spacing | local-component | cards | yes |",
  "| 10:00 | Settings | 9/9 | jumped page | none | local-component | form | yes |",
]));

fs.writeFileSync(validSwitchLedger, ledgerWithCheckpoints([
  "| 09:00 | Dashboard | 5/5 | button fix | spacing | local-component | cards | yes |",
  "| 10:00 | Settings | 9/9 | switched after Dashboard blocked by missing API state | none | local-component | form | yes |",
], "Dashboard blocked by missing API state"));

const valid = spawnSync(process.execPath, [
  script,
  "--ledger",
  validLedger,
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(valid.status, 0, valid.stderr || valid.stdout);
const validSummary = JSON.parse(valid.stdout);
assert.equal(validSummary.ok, true);
assert.equal(validSummary.activePage, "Dashboard");
assert.equal(validSummary.checkpointCount, 2);
assert.deepEqual(validSummary.checkpointPages, ["Dashboard"]);

const invalid = spawnSync(process.execPath, [
  script,
  "--ledger",
  invalidSwitchLedger,
], {
  encoding: "utf8",
  env: process.env,
});

assert.notEqual(invalid.status, 0);
assert.match(invalid.stderr, /checkpoint page switched/i);

const validSwitch = spawnSync(process.execPath, [
  script,
  "--ledger",
  validSwitchLedger,
], {
  encoding: "utf8",
  env: process.env,
});

assert.equal(validSwitch.status, 0, validSwitch.stderr || validSwitch.stdout);
const validSwitchSummary = JSON.parse(validSwitch.stdout);
assert.equal(validSwitchSummary.ok, true);
assert.deepEqual(validSwitchSummary.checkpointPages, ["Dashboard", "Settings"]);
assert.equal(validSwitchSummary.switchReason, "Dashboard blocked by missing API state");

console.log("visual_ledger_check test passed");
