#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parseArgs } = require("./visual_compare");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function parseTsv(tsv) {
  const lines = tsv.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function runTesseract(imagePath, options) {
  const outputBase = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "visual-ocr-")), "ocr");
  const input = fs.readFileSync(imagePath);
  const result = spawnSync("tesseract", [
    "stdin",
    outputBase,
    "--psm",
    String(options.psm),
    "tsv",
  ], {
    input,
    encoding: "buffer",
  });

  if (result.status !== 0) {
    throw new Error(Buffer.concat([result.stderr, result.stdout]).toString("utf8"));
  }
  const tsvPath = `${outputBase}.tsv`;
  return fs.readFileSync(tsvPath, "utf8");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function lcsLength(a, b) {
  const previous = new Array(b.length + 1).fill(0);
  const current = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }
  return previous[b.length];
}

function textSimilarity(a, b) {
  const left = normalizeText(a).toLowerCase();
  const right = normalizeText(b).toLowerCase();
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  return (2 * lcsLength(left, right)) / (left.length + right.length);
}

function wordsFromTsv(tsv, minConfidence) {
  return parseTsv(tsv).flatMap((row) => {
    const text = normalizeText(row.text);
    const confidence = Number.parseFloat(row.conf);
    if (!text || !Number.isFinite(confidence) || confidence < minConfidence) return [];
    const left = Number.parseInt(row.left, 10);
    const top = Number.parseInt(row.top, 10);
    const width = Number.parseInt(row.width, 10);
    const height = Number.parseInt(row.height, 10);
    if (![left, top, width, height].every(Number.isFinite)) return [];
    return [{
      text,
      confidence,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      lineKey: [row.block_num, row.par_num, row.line_num].join(":"),
    }];
  });
}

function groupLines(words) {
  const groups = new Map();
  for (const word of words) {
    if (!groups.has(word.lineKey)) groups.set(word.lineKey, []);
    groups.get(word.lineKey).push(word);
  }
  return Array.from(groups.entries()).map(([lineKey, lineWords]) => {
    const sorted = lineWords.slice().sort((a, b) => a.left - b.left);
    const left = Math.min(...sorted.map((word) => word.left));
    const top = Math.min(...sorted.map((word) => word.top));
    const right = Math.max(...sorted.map((word) => word.right));
    const bottom = Math.max(...sorted.map((word) => word.bottom));
    return {
      lineKey,
      text: sorted.map((word) => word.text).join(" "),
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      words: sorted,
    };
  }).sort((a, b) => (a.top - b.top) || (a.left - b.left));
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function compareOcrLines(referenceLines, candidateLines, minSimilarity) {
  const usedCandidates = new Set();
  const deltas = [];
  const missingReference = [];

  for (const referenceLine of referenceLines) {
    let best = null;
    for (let i = 0; i < candidateLines.length; i += 1) {
      if (usedCandidates.has(i)) continue;
      const candidateLine = candidateLines[i];
      const similarity = textSimilarity(referenceLine.text, candidateLine.text);
      if (similarity < minSimilarity) continue;
      if (!best || similarity > best.similarity) {
        best = { index: i, candidateLine, similarity };
      }
    }
    if (!best) {
      missingReference.push(referenceLine);
      continue;
    }
    usedCandidates.add(best.index);
    const candidateLine = best.candidateLine;
    deltas.push({
      text: referenceLine.text,
      candidateText: candidateLine.text,
      similarity: Number(best.similarity.toFixed(4)),
      dx: candidateLine.left - referenceLine.left,
      dy: candidateLine.top - referenceLine.top,
      dw: candidateLine.width - referenceLine.width,
      dh: candidateLine.height - referenceLine.height,
      referenceBox: {
        left: referenceLine.left,
        top: referenceLine.top,
        width: referenceLine.width,
        height: referenceLine.height,
      },
      candidateBox: {
        left: candidateLine.left,
        top: candidateLine.top,
        width: candidateLine.width,
        height: candidateLine.height,
      },
    });
  }

  const missingCandidate = candidateLines.filter((_, index) => !usedCandidates.has(index));
  const sortedByDelta = deltas.slice().sort((a, b) => Math.abs(b.dy) - Math.abs(a.dy));
  return {
    referenceLines: referenceLines.length,
    candidateLines: candidateLines.length,
    matchedLines: deltas.length,
    missingReferenceLines: missingReference.length,
    missingCandidateLines: missingCandidate.length,
    averageAbsLeftDelta: average(deltas.map((delta) => Math.abs(delta.dx))),
    averageAbsTopDelta: average(deltas.map((delta) => Math.abs(delta.dy))),
    averageAbsWidthDelta: average(deltas.map((delta) => Math.abs(delta.dw))),
    averageAbsHeightDelta: average(deltas.map((delta) => Math.abs(delta.dh))),
    maxAbsTopDelta: deltas.length ? Math.max(...deltas.map((delta) => Math.abs(delta.dy))) : 0,
    worstLineDeltas: sortedByDelta.slice(0, 10),
    missingReference: missingReference.slice(0, 10).map((line) => line.text),
    missingCandidate: missingCandidate.slice(0, 10).map((line) => line.text),
  };
}

function compareImagesWithOcr(options) {
  const referenceTsv = runTesseract(options.reference, options);
  const candidateTsv = runTesseract(options.candidate, options);
  const referenceLines = groupLines(wordsFromTsv(referenceTsv, options.minConfidence));
  const candidateLines = groupLines(wordsFromTsv(candidateTsv, options.minConfidence));
  return {
    reference: path.resolve(options.reference),
    candidate: path.resolve(options.candidate),
    psm: options.psm,
    minConfidence: options.minConfidence,
    minSimilarity: options.minSimilarity,
    ...compareOcrLines(referenceLines, candidateLines, options.minSimilarity),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = compareImagesWithOcr({
    reference: required(args, "reference"),
    candidate: required(args, "candidate"),
    psm: parsePositiveInt(args.psm || "6", "psm"),
    minConfidence: Number.parseFloat(args["min-confidence"] || "25"),
    minSimilarity: Number.parseFloat(args["min-similarity"] || "0.35"),
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  compareImagesWithOcr,
  compareOcrLines,
  groupLines,
  textSimilarity,
  wordsFromTsv,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
