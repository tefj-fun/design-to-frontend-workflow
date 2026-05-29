#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const pixelmatchModule = require("pixelmatch");
const { PNG } = require("pngjs");
const {
  compareImages,
  normalizePng,
  parseArgs,
  parsePositiveInt,
  parseThreshold,
  renderTarget,
} = require("./visual_compare");

const pixelmatch = pixelmatchModule.default || pixelmatchModule;

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function applyTemplate(template, values) {
  return template.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`Missing template value: ${key}`);
    }
    return String(values[key]);
  });
}

function writeCandidateHtml(template, values, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, applyTemplate(template, values));
}

function copyRegion(source, x, y, width, height, sourceWidth) {
  const region = new PNG({ width, height });
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const srcOffset = ((y + row) * sourceWidth + (x + col)) * 4;
      const dstOffset = (row * width + col) * 4;
      region.data[dstOffset] = source.data[srcOffset];
      region.data[dstOffset + 1] = source.data[srcOffset + 1];
      region.data[dstOffset + 2] = source.data[srcOffset + 2];
      region.data[dstOffset + 3] = source.data[srcOffset + 3];
    }
  }
  return region;
}

async function compareRegions(options) {
  const referencePng = await normalizePng(options.reference, options.width, options.height);
  const candidatePng = await normalizePng(options.candidate, options.width, options.height);
  const regions = [];

  for (let row = 0; row < options.gridRows; row += 1) {
    for (let col = 0; col < options.gridCols; col += 1) {
      const x = Math.floor((col * options.width) / options.gridCols);
      const y = Math.floor((row * options.height) / options.gridRows);
      const nextX = Math.floor(((col + 1) * options.width) / options.gridCols);
      const nextY = Math.floor(((row + 1) * options.height) / options.gridRows);
      const regionWidth = nextX - x;
      const regionHeight = nextY - y;
      const referenceRegion = copyRegion(referencePng, x, y, regionWidth, regionHeight, options.width);
      const candidateRegion = copyRegion(candidatePng, x, y, regionWidth, regionHeight, options.width);
      const diffRegion = new PNG({ width: regionWidth, height: regionHeight });
      const mismatchedPixels = pixelmatch(
        referenceRegion.data,
        candidateRegion.data,
        diffRegion.data,
        regionWidth,
        regionHeight,
        { threshold: options.threshold }
      );
      const totalPixels = regionWidth * regionHeight;
      regions.push({
        row,
        col,
        x,
        y,
        width: regionWidth,
        height: regionHeight,
        mismatchedPixels,
        totalPixels,
        mismatchPercent: Number(((mismatchedPixels / totalPixels) * 100).toFixed(2)),
      });
    }
  }

  regions.sort((a, b) => b.mismatchedPixels - a.mismatchedPixels);
  return regions;
}

function normalizeIterationBatches(variants, maxIterations) {
  const batches = Array.isArray(variants.iterations) ? variants.iterations : [];
  return batches.slice(0, maxIterations).map((batch) => {
    if (!Array.isArray(batch)) {
      throw new Error("Each variants.iterations item must be an array of candidates");
    }
    return batch;
  });
}

async function scoreCandidate(options) {
  const html = path.join(options.outputDir, `${options.name}.html`);
  const rendered = path.join(options.outputDir, `${options.name}.png`);
  const diff = path.join(options.outputDir, `${options.name}-diff.png`);

  writeCandidateHtml(options.template, options.values, html);
  await renderTarget(html, rendered, options.width, options.height);
  const summary = await compareImages({
    reference: options.reference,
    candidate: rendered,
    diff,
    width: options.width,
    height: options.height,
    threshold: options.threshold,
  });
  const regions = await compareRegions({
    reference: options.reference,
    candidate: rendered,
    width: options.width,
    height: options.height,
    threshold: options.threshold,
    gridCols: options.gridCols,
    gridRows: options.gridRows,
  });

  return {
    label: options.label,
    values: options.values,
    html,
    rendered,
    diff,
    mismatchedPixels: summary.mismatchedPixels,
    totalPixels: summary.totalPixels,
    mismatchPercent: summary.mismatchPercent,
    regions,
  };
}

async function runLoop(options) {
  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const template = fs.readFileSync(options.template, "utf8");
  const variants = readJson(options.variants);
  let currentValues = { ...(variants.baseline || {}) };
  const history = [];
  const accepted = [];

  let current = await scoreCandidate({
    ...options,
    outputDir,
    template,
    values: currentValues,
    label: "baseline",
    name: "iteration-00-baseline",
  });
  history.push({ iteration: 0, candidates: [current], accepted: current });

  const batches = normalizeIterationBatches(variants, options.maxIterations);
  for (let i = 0; i < batches.length; i += 1) {
    const candidates = [];
    for (let j = 0; j < batches[i].length; j += 1) {
      const candidate = batches[i][j];
      const label = candidate.label || `iteration-${i + 1}-candidate-${j + 1}`;
      const values = { ...currentValues, ...(candidate.values || {}) };
      candidates.push(await scoreCandidate({
        ...options,
        outputDir,
        template,
        values,
        label,
        name: `iteration-${String(i + 1).padStart(2, "0")}-${String(j + 1).padStart(2, "0")}-${label.replace(/[^a-z0-9_-]+/gi, "-")}`,
      }));
    }

    candidates.sort((a, b) => a.mismatchedPixels - b.mismatchedPixels);
    const best = candidates[0];
    const improved = best && best.mismatchedPixels < current.mismatchedPixels;
    if (improved) {
      current = best;
      currentValues = best.values;
      accepted.push(best);
    }
    history.push({
      iteration: i + 1,
      candidates,
      accepted: improved ? best : null,
      rejectedBecause: improved ? null : "no candidate improved global mismatch",
    });
    if (!improved) {
      break;
    }
  }

  const summary = {
    reference: path.resolve(options.reference),
    width: options.width,
    height: options.height,
    threshold: options.threshold,
    gridCols: options.gridCols,
    gridRows: options.gridRows,
    accepted,
    final: current,
    historyPath: path.join(outputDir, "history.json"),
  };
  fs.writeFileSync(summary.historyPath, JSON.stringify(history, null, 2));
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    reference: required(args, "reference"),
    template: required(args, "template"),
    variants: required(args, "variants"),
    outputDir: required(args, "output-dir"),
    width: parsePositiveInt(args.width || "1280", "width"),
    height: parsePositiveInt(args.height || "720", "height"),
    threshold: parseThreshold(args.threshold || "0.1"),
    maxIterations: parsePositiveInt(args["max-iterations"] || "8", "max-iterations"),
    gridCols: parsePositiveInt(args["grid-cols"] || "4", "grid-cols"),
    gridRows: parsePositiveInt(args["grid-rows"] || "4", "grid-rows"),
  };
  const summary = await runLoop(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  applyTemplate,
  compareRegions,
  normalizeIterationBatches,
  runLoop,
  scoreCandidate,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
