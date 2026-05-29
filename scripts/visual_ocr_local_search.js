#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  compareImages,
  parseArgs,
  parsePositiveInt,
  parseThreshold,
} = require("./visual_compare");
const { applyTemplate } = require("./visual_refine_loop");
const { compareImagesWithOcr } = require("./visual_ocr_compare");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseOptionalNumber(value, name) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a number`);
  }
  return parsed;
}

function safeLabel(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
}

function candidateName(pass, index, parameter, value) {
  return `pass-${String(pass).padStart(2, "0")}-${String(index).padStart(3, "0")}-${parameter}-${safeLabel(value)}`;
}

function writeCandidateHtml(template, values, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const html = applyTemplate(template, values);
  fs.writeFileSync(outputFile, html);
  return html;
}

async function createBrowserPage(width, height) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch (error) {
    throw new Error("Rendering requires the playwright package. Use an environment with playwright installed.");
  }
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  return { browser, page };
}

function normalizeSearchSpace(searchSpace) {
  if (!searchSpace || typeof searchSpace !== "object") {
    throw new Error("Search space must be a JSON object");
  }
  if (!searchSpace.baseline || typeof searchSpace.baseline !== "object") {
    throw new Error("Search space requires a baseline object");
  }
  if (!searchSpace.parameters || typeof searchSpace.parameters !== "object") {
    throw new Error("Search space requires a parameters object");
  }
  for (const [key, values] of Object.entries(searchSpace.parameters)) {
    if (!Array.isArray(values) || !values.length) {
      throw new Error(`Search-space parameter ${key} must be a non-empty array`);
    }
  }
  return searchSpace;
}

function ocrMetric(candidate, key) {
  const value = candidate.ocr ? candidate.ocr[key] : 0;
  return Number.isFinite(value) ? value : 0;
}

function scoreTuple(candidate) {
  return [
    ocrMetric(candidate, "missingReferenceLines"),
    ocrMetric(candidate, "missingCandidateLines"),
    ocrMetric(candidate, "maxAbsTopDelta"),
    ocrMetric(candidate, "averageAbsTopDelta"),
    ocrMetric(candidate, "averageAbsLeftDelta"),
    ocrMetric(candidate, "averageAbsWidthDelta"),
    ocrMetric(candidate, "averageAbsHeightDelta"),
    candidate.mismatchedPixels,
  ];
}

function compareCandidateScores(left, right) {
  const leftTuple = scoreTuple(left);
  const rightTuple = scoreTuple(right);
  for (let i = 0; i < leftTuple.length; i += 1) {
    if (leftTuple[i] < rightTuple[i]) return -1;
    if (leftTuple[i] > rightTuple[i]) return 1;
  }
  return 0;
}

function missingLineCount(candidate) {
  return ocrMetric(candidate, "missingReferenceLines") + ocrMetric(candidate, "missingCandidateLines");
}

async function scoreValues(options) {
  const html = path.join(options.outputDir, `${options.name}.html`);
  const rendered = path.join(options.outputDir, `${options.name}.png`);
  const diff = path.join(options.outputDir, `${options.name}-diff.png`);

  const htmlContent = writeCandidateHtml(options.template, options.values, html);
  await options.page.setContent(htmlContent, { waitUntil: "load" });
  await options.page.screenshot({ path: rendered, fullPage: false });

  const pixel = await compareImages({
    reference: options.reference,
    candidate: rendered,
    diff,
    width: options.width,
    height: options.height,
    threshold: options.threshold,
  });

  const ocr = compareImagesWithOcr({
    reference: options.ocrReference,
    candidate: rendered,
    psm: options.psm,
    minConfidence: options.minConfidence,
    minSimilarity: options.minSimilarity,
  });

  return {
    label: options.label,
    parameter: options.parameter,
    value: options.value,
    values: options.values,
    html,
    rendered,
    diff,
    mismatchedPixels: pixel.mismatchedPixels,
    totalPixels: pixel.totalPixels,
    mismatchPercent: pixel.mismatchPercent,
    ocr,
    scoreTuple: scoreTuple({ mismatchedPixels: pixel.mismatchedPixels, ocr }),
  };
}

function withinPixelLimit(candidate, maxMismatchPercent) {
  return maxMismatchPercent === null || candidate.mismatchPercent <= maxMismatchPercent;
}

function canConsiderCandidate(candidate, current, maxMismatchPercent) {
  if (withinPixelLimit(candidate, maxMismatchPercent)) return true;
  return missingLineCount(candidate) < missingLineCount(current);
}

async function runOcrLocalSearch(options) {
  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const template = fs.readFileSync(options.template, "utf8");
  const searchSpace = normalizeSearchSpace(readJson(options.searchSpace));
  const history = [];
  const accepted = [];
  const { browser, page } = await createBrowserPage(options.width, options.height);

  try {
    const historyPath = path.join(outputDir, "history.json");
    let current = await scoreValues({
      ...options,
      outputDir,
      template,
      page,
      values: { ...searchSpace.baseline },
      label: "baseline",
      name: "baseline",
      parameter: null,
      value: null,
    });
    let currentValues = { ...current.values };

    for (let pass = 1; pass <= options.maxPasses; pass += 1) {
      let best = current;
      const candidates = [];
      let index = 0;
      for (const [parameter, values] of Object.entries(searchSpace.parameters)) {
        for (const value of values) {
          if (currentValues[parameter] === value) continue;
          index += 1;
          const candidateValues = { ...currentValues, [parameter]: value };
          const candidate = await scoreValues({
            ...options,
            outputDir,
            template,
            page,
            values: candidateValues,
            label: `${parameter}=${value}`,
            name: candidateName(pass, index, parameter, value),
            parameter,
            value,
          });
          candidates.push(candidate);
          if (
            canConsiderCandidate(candidate, current, options.maxMismatchPercent) &&
            compareCandidateScores(candidate, best) < 0
          ) {
            best = candidate;
          }
        }
      }

      const improved = compareCandidateScores(best, current) < 0;
      history.push({
        pass,
        start: current,
        candidates,
        accepted: improved ? best : null,
        rejectedBecause: improved ? null : "no candidate improved OCR-first score",
      });
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

      if (!improved) break;
      current = best;
      currentValues = { ...best.values };
      accepted.push(best);
    }

    const summary = {
      reference: path.resolve(options.reference),
      ocrReference: path.resolve(options.ocrReference),
      width: options.width,
      height: options.height,
      threshold: options.threshold,
      maxMismatchPercent: options.maxMismatchPercent,
      accepted,
      final: current,
      historyPath,
    };
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    return summary;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reference = required(args, "reference");
  const options = {
    reference,
    ocrReference: args["ocr-reference"] || reference,
    template: required(args, "template"),
    searchSpace: required(args, "search-space"),
    outputDir: required(args, "output-dir"),
    width: parsePositiveInt(args.width || "1280", "width"),
    height: parsePositiveInt(args.height || "720", "height"),
    threshold: parseThreshold(args.threshold || "0.1"),
    maxPasses: parsePositiveInt(args["max-passes"] || "5", "max-passes"),
    psm: parsePositiveInt(args.psm || "6", "psm"),
    minConfidence: parseOptionalNumber(args["min-confidence"] || "25", "min-confidence"),
    minSimilarity: parseOptionalNumber(args["min-similarity"] || "0.35", "min-similarity"),
    maxMismatchPercent: parseOptionalNumber(args["max-mismatch-percent"], "max-mismatch-percent"),
  };
  const summary = await runOcrLocalSearch(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  canConsiderCandidate,
  compareCandidateScores,
  runOcrLocalSearch,
  scoreTuple,
  scoreValues,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
