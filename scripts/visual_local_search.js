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
const {
  applyTemplate,
} = require("./visual_refine_loop");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

async function scoreValues(options) {
  const html = path.join(options.outputDir, `${options.name}.html`);
  const rendered = path.join(options.outputDir, `${options.name}.png`);
  const diff = path.join(options.outputDir, `${options.name}-diff.png`);

  const htmlContent = writeCandidateHtml(options.template, options.values, html);
  await options.page.setContent(htmlContent, { waitUntil: "load" });
  await options.page.screenshot({ path: rendered, fullPage: false });
  const summary = await compareImages({
    reference: options.reference,
    candidate: rendered,
    diff,
    width: options.width,
    height: options.height,
    threshold: options.threshold,
  });
  return {
    label: options.label,
    parameter: options.parameter,
    value: options.value,
    values: options.values,
    html,
    rendered,
    diff,
    mismatchedPixels: summary.mismatchedPixels,
    totalPixels: summary.totalPixels,
    mismatchPercent: summary.mismatchPercent,
  };
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

async function runLocalSearch(options) {
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
          if (candidate.mismatchedPixels < best.mismatchedPixels) {
            best = candidate;
          }
        }
      }

      const improved = best.mismatchedPixels < current.mismatchedPixels;
      history.push({
        pass,
        start: current,
        candidates,
        accepted: improved ? best : null,
        rejectedBecause: improved ? null : "no candidate improved global mismatch",
      });
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

      if (!improved) break;
      current = best;
      currentValues = { ...best.values };
      accepted.push(best);
    }

    const summary = {
      reference: path.resolve(options.reference),
      width: options.width,
      height: options.height,
      threshold: options.threshold,
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
  const options = {
    reference: required(args, "reference"),
    template: required(args, "template"),
    searchSpace: required(args, "search-space"),
    outputDir: required(args, "output-dir"),
    width: parsePositiveInt(args.width || "1280", "width"),
    height: parsePositiveInt(args.height || "720", "height"),
    threshold: parseThreshold(args.threshold || "0.1"),
    maxPasses: parsePositiveInt(args["max-passes"] || "5", "max-passes"),
  };
  const summary = await runLocalSearch(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  runLocalSearch,
  scoreValues,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
