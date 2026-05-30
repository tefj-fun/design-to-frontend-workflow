#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("./visual_compare");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statIfExists(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function artifact(role, filePath, baselineMs = null) {
  const resolved = path.resolve(filePath);
  const stat = statIfExists(resolved);
  const exists = Boolean(stat);
  const mtimeMs = exists ? stat.mtimeMs : null;
  const stale = exists && baselineMs !== null ? mtimeMs < baselineMs : false;
  return {
    role,
    path: resolved,
    exists,
    mtimeMs,
    mtime: exists ? new Date(mtimeMs).toISOString() : null,
    stale,
  };
}

function readScore(scorePath) {
  return JSON.parse(fs.readFileSync(path.resolve(scorePath), "utf8"));
}

function artifactPathsFromScore(scorePath, score) {
  const items = [
    { role: "score", filePath: path.resolve(scorePath) },
  ];
  for (const role of ["reference", "candidate", "diff", "rendered"]) {
    if (score[role]) {
      items.push({ role, filePath: score[role] });
    }
  }
  return items;
}

function baselineFromOptions(options) {
  const baselines = [];
  for (const sourcePath of options.newerThan) {
    const resolved = path.resolve(sourcePath);
    const stat = statIfExists(resolved);
    if (!stat) {
      throw new Error(`--newer-than source does not exist: ${resolved}`);
    }
    baselines.push({
      type: "file",
      path: resolved,
      mtimeMs: stat.mtimeMs,
      mtime: new Date(stat.mtimeMs).toISOString(),
    });
  }
  if (options.minMtime) {
    const parsed = Date.parse(options.minMtime);
    if (!Number.isFinite(parsed)) {
      throw new Error("--min-mtime must be an ISO timestamp or parseable date");
    }
    baselines.push({
      type: "timestamp",
      value: options.minMtime,
      mtimeMs: parsed,
      mtime: new Date(parsed).toISOString(),
    });
  }
  if (!baselines.length) {
    return null;
  }
  const newest = baselines.reduce((best, item) => (item.mtimeMs > best.mtimeMs ? item : best), baselines[0]);
  return {
    mtimeMs: newest.mtimeMs,
    mtime: newest.mtime,
    sources: baselines,
  };
}

function checkArtifacts(options) {
  const scorePath = path.resolve(options.score);
  const score = readScore(scorePath);
  const baseline = baselineFromOptions(options);
  const baselineMs = baseline ? baseline.mtimeMs : null;
  const artifacts = artifactPathsFromScore(scorePath, score).map((item) => artifact(item.role, item.filePath, baselineMs));
  const missing = artifacts.filter((item) => !item.exists);
  const stale = artifacts.filter((item) => item.stale);
  return {
    ok: missing.length === 0 && stale.length === 0,
    score: scorePath,
    baseline,
    artifacts,
    missing,
    stale,
  };
}

function formatFailures(summary) {
  const messages = [];
  for (const item of summary.missing) {
    messages.push(`${item.role} is missing: ${item.path}`);
  }
  for (const item of summary.stale) {
    messages.push(`${item.role} is stale: ${item.path}`);
  }
  return messages.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = checkArtifacts({
    score: required(args, "score"),
    newerThan: splitList(args["newer-than"]),
    minMtime: args["min-mtime"] || null,
  });
  if (!summary.ok) {
    throw new Error(formatFailures(summary));
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  artifact,
  artifactPathsFromScore,
  baselineFromOptions,
  checkArtifacts,
  formatFailures,
  readScore,
  splitList,
  statIfExists,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
