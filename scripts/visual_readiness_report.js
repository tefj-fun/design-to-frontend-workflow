#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("./visual_compare");
const {
  checkArtifacts,
  formatFailures,
  readScore,
  splitList,
} = require("./visual_artifact_check");
const { checkLedger } = require("./visual_ledger_check");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function pass(name, summary = {}) {
  return { name, ok: true, ...summary };
}

function fail(name, message, summary = {}) {
  return { name, ok: false, message, ...summary };
}

function parseOptionalNumber(value, name) {
  if (value === undefined || value === null || value === false) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a finite number`);
  }
  return parsed;
}

function numberInRange(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function checkArtifactFreshness(options) {
  const summary = checkArtifacts({
    score: options.score,
    newerThan: options.newerThan,
    minMtime: options.minMtime,
  });
  if (!summary.ok) {
    return fail("artifact-freshness", formatFailures(summary), {
      missing: summary.missing,
      stale: summary.stale,
      baseline: summary.baseline,
    });
  }
  return pass("artifact-freshness", {
    artifactCount: summary.artifacts.length,
    baseline: summary.baseline,
  });
}

function checkScoreSanity(score) {
  const failures = [];
  const sanity = score.sanity || {};
  const uiMaskedMismatch = score.uiMaskedMismatch ?? score.mismatchPercent;
  const fullPageMismatch = score.fullPageMismatch ?? score.mismatchPercent;

  if (sanity.dimensionsMatch === false) {
    failures.push("dimensionsMatch is false");
  }
  if (sanity.scoreInvariantOk === false) {
    failures.push("scoreInvariantOk is false");
  }
  if (!numberInRange(uiMaskedMismatch)) {
    failures.push("uiMaskedMismatch must be between 0 and 100");
  }
  if (!numberInRange(fullPageMismatch)) {
    failures.push("fullPageMismatch must be between 0 and 100");
  }
  if (numberInRange(uiMaskedMismatch) && numberInRange(fullPageMismatch) && uiMaskedMismatch > fullPageMismatch) {
    failures.push("uiMaskedMismatch cannot exceed fullPageMismatch");
  }

  const summary = {
    uiMaskedMismatch,
    fullPageMismatch,
    dimensionsMatch: sanity.dimensionsMatch,
    scoreInvariantOk: sanity.scoreInvariantOk,
  };
  if (failures.length) {
    return fail("score-sanity", failures.join("; "), summary);
  }
  return pass("score-sanity", summary);
}

function checkThreshold(score, options) {
  const failures = [];
  const uiMaskedMismatch = score.uiMaskedMismatch ?? score.mismatchPercent;
  const fullPageMismatch = score.fullPageMismatch ?? score.mismatchPercent;

  if (options.maxUiMismatch !== null && uiMaskedMismatch > options.maxUiMismatch) {
    failures.push(`uiMaskedMismatch ${uiMaskedMismatch} exceeds max ${options.maxUiMismatch}`);
  }
  if (options.maxFullMismatch !== null && fullPageMismatch > options.maxFullMismatch) {
    failures.push(`fullPageMismatch ${fullPageMismatch} exceeds max ${options.maxFullMismatch}`);
  }

  const summary = {
    uiMaskedMismatch,
    fullPageMismatch,
    maxUiMismatch: options.maxUiMismatch,
    maxFullMismatch: options.maxFullMismatch,
  };
  if (failures.length) {
    return fail("threshold", failures.join("; "), summary);
  }
  return pass("threshold", summary);
}

function checkLedgerEvidence(ledgerPath) {
  const markdown = fs.readFileSync(path.resolve(ledgerPath), "utf8");
  try {
    return pass("ledger", checkLedger(markdown, ledgerPath));
  } catch (error) {
    return fail("ledger", error.message, { ledger: path.resolve(ledgerPath) });
  }
}

function checkSummaryJson(name, filePath) {
  const summary = readJson(filePath);
  if (summary.ok !== true) {
    return fail(name, `${name} ok is not true`, {
      path: path.resolve(filePath),
      summary,
    });
  }
  return pass(name, {
    path: path.resolve(filePath),
    summary,
  });
}

function checkRegionDiagnostics(score) {
  const regionCount = Number(score.sanity && score.sanity.regionCount);
  const regions = Array.isArray(score.regionMismatch) ? score.regionMismatch : [];
  if (regions.length === 0 && !(Number.isFinite(regionCount) && regionCount > 0)) {
    return fail("region-diagnostics", "region diagnostics are required but missing", {
      regionCount: Number.isFinite(regionCount) ? regionCount : null,
    });
  }
  return pass("region-diagnostics", {
    regionCount: regions.length || regionCount,
  });
}

function buildReadinessReport(options) {
  const scorePath = path.resolve(options.score);
  const score = readScore(scorePath);
  const checks = [
    checkArtifactFreshness(options),
    checkScoreSanity(score),
    checkThreshold(score, options),
  ];

  if (options.ledger) {
    checks.push(checkLedgerEvidence(options.ledger));
  }
  if (options.interactionSummary) {
    checks.push(checkSummaryJson("interaction-summary", options.interactionSummary));
  }
  if (options.ocrSummary) {
    checks.push(checkSummaryJson("ocr-summary", options.ocrSummary));
  }
  if (options.requireRegions) {
    checks.push(checkRegionDiagnostics(score));
  }

  const blockers = checks
    .filter((check) => !check.ok)
    .map((check) => `${check.name}: ${check.message}`);

  return {
    ok: blockers.length === 0,
    score: scorePath,
    checks,
    blockers,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReadinessReport({
    score: required(args, "score"),
    newerThan: splitList(args["newer-than"]),
    minMtime: args["min-mtime"] || null,
    ledger: args.ledger || null,
    interactionSummary: args["interaction-summary"] || null,
    ocrSummary: args["ocr-summary"] || null,
    maxUiMismatch: parseOptionalNumber(args["max-ui-mismatch"], "max-ui-mismatch"),
    maxFullMismatch: parseOptionalNumber(args["max-full-mismatch"], "max-full-mismatch"),
    requireRegions: Boolean(args["require-regions"]),
  });

  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), output);
  }
  if (!report.ok) {
    process.stderr.write(`${report.blockers.join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(output);
}

module.exports = {
  buildReadinessReport,
  checkArtifactFreshness,
  checkLedgerEvidence,
  checkRegionDiagnostics,
  checkScoreSanity,
  checkSummaryJson,
  checkThreshold,
  fail,
  parseOptionalNumber,
  pass,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
