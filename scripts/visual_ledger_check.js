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

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseSections(markdown) {
  const sections = new Map();
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections.set(current, []);
      continue;
    }
    if (current) {
      sections.get(current).push(line);
    }
  }
  return sections;
}

function requireSection(sections, name) {
  const lines = sections.get(name);
  if (!lines) {
    throw new Error(`Ledger missing required section: ${name}`);
  }
  return lines;
}

function readBulletValue(lines, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*-\\s*${escaped}:\\s*(.*)$`, "i");
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      return normalizeText(match[1]);
    }
  }
  return "";
}

function parsePipeRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => normalizeText(cell));
  const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  return isSeparator ? null : cells;
}

function parseCheckpointRows(lines) {
  const rows = [];
  for (const line of lines) {
    const row = parsePipeRow(line);
    if (row) {
      rows.push(row);
    }
  }
  if (!rows.length) {
    return [];
  }
  const headers = rows[0].map((header) => header.toLowerCase());
  const activePageIndex = headers.indexOf("active page");
  if (activePageIndex === -1) {
    throw new Error("Checkpoints table missing Active page column");
  }
  return rows.slice(1).map((row, index) => {
    const activePage = normalizeText(row[activePageIndex]);
    if (!activePage) {
      throw new Error(`Checkpoint row ${index + 1} has blank Active page`);
    }
    return {
      index: index + 1,
      activePage,
      row,
    };
  });
}

function uniqueInOrder(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

function checkLedger(markdown, ledgerPath = null) {
  const sections = parseSections(markdown);
  const activePageLines = requireSection(sections, "Active Page Lock");
  const checkpointLines = requireSection(sections, "Checkpoints");
  const activePage = readBulletValue(activePageLines, "Active page/route/state");
  const exitCondition = readBulletValue(activePageLines, "Exit condition");
  const switchReason = readBulletValue(activePageLines, "Switch reason, if changing pages");
  if (!activePage) {
    throw new Error("Active Page Lock requires Active page/route/state");
  }
  if (!exitCondition) {
    throw new Error("Active Page Lock requires Exit condition");
  }

  const checkpoints = parseCheckpointRows(checkpointLines);
  const checkpointPages = uniqueInOrder(checkpoints.map((checkpoint) => checkpoint.activePage));
  if (checkpointPages.length > 1 && !switchReason) {
    throw new Error(`checkpoint page switched without Switch reason: ${checkpointPages.join(" -> ")}`);
  }

  return {
    ok: true,
    ledger: ledgerPath ? path.resolve(ledgerPath) : null,
    activePage,
    exitCondition,
    switchReason,
    checkpointCount: checkpoints.length,
    checkpointPages,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledger = required(args, "ledger");
  const markdown = fs.readFileSync(path.resolve(ledger), "utf8");
  const summary = checkLedger(markdown, ledger);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  checkLedger,
  normalizeText,
  parseCheckpointRows,
  parsePipeRow,
  parseSections,
  readBulletValue,
  uniqueInOrder,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
