#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  parseArgs,
  parseFiniteNumber,
  parsePositiveInt,
  targetToUrl,
} = require("./visual_compare");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function readSourceRegions(sourcePath) {
  const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), "utf8"));
  const regions = Array.isArray(source) ? source : source && source.regions;
  if (!Array.isArray(regions)) {
    throw new Error("--source must be a JSON array or an object with a regions array");
  }
  return regions.map((region, index) => {
    if (!region || typeof region !== "object") {
      throw new Error(`Region source ${index + 1} must be an object`);
    }
    if (!region.id) {
      throw new Error(`Region source ${index + 1} requires an id`);
    }
    if (!region.selector && !region.text) {
      throw new Error(`Region ${region.id} requires selector or text`);
    }
    return region;
  });
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function resolvePadding(region) {
  const base = region.padding === undefined ? 0 : parseFiniteNumber(region.padding, `region ${region.id} padding`);
  return {
    top: region.paddingTop === undefined ? base : parseFiniteNumber(region.paddingTop, `region ${region.id} paddingTop`),
    right: region.paddingRight === undefined ? base : parseFiniteNumber(region.paddingRight, `region ${region.id} paddingRight`),
    bottom: region.paddingBottom === undefined ? base : parseFiniteNumber(region.paddingBottom, `region ${region.id} paddingBottom`),
    left: region.paddingLeft === undefined ? base : parseFiniteNumber(region.paddingLeft, `region ${region.id} paddingLeft`),
  };
}

function round2(value) {
  return Number(value.toFixed(2));
}

function boxWithPadding(rect, padding, width, height) {
  const left = Math.max(0, rect.x - padding.left);
  const top = Math.max(0, rect.y - padding.top);
  const right = Math.min(width, rect.x + rect.width + padding.right);
  const bottom = Math.min(height, rect.y + rect.height + padding.bottom);
  return {
    x: round2(left),
    y: round2(top),
    width: round2(Math.max(0, right - left)),
    height: round2(Math.max(0, bottom - top)),
  };
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

async function resolveRegionRects(page, sourceRegions) {
  return await page.evaluate((regions) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") === 0) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const findByText = (region) => {
      const wanted = normalize(region.text);
      const match = region.match || "exact";
      const elements = Array.from(document.body.querySelectorAll("*")).filter(isVisible);
      return elements.find((element) => {
        const text = normalize(element.innerText || element.getAttribute("aria-label") || element.getAttribute("alt") || "");
        if (!text) return false;
        return match === "contains" ? text.includes(wanted) : text === wanted;
      });
    };

    return regions.map((region) => {
      const element = region.selector ? document.querySelector(region.selector) : findByText(region);
      if (!element) {
        throw new Error(`Region ${region.id} did not match any visible element`);
      }
      if (!isVisible(element)) {
        throw new Error(`Region ${region.id} matched an invisible element`);
      }
      const rect = element.getBoundingClientRect();
      return {
        id: region.id,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        source: region.selector ? "selector" : "text",
      };
    });
  }, sourceRegions);
}

async function generateRegionManifest(options) {
  const width = options.width;
  const height = options.height;
  const sourceRegions = readSourceRegions(options.source);
  const { browser, page } = await createBrowserPage(width, height);
  try {
    await page.goto(targetToUrl(options.target), { waitUntil: "networkidle" });
    const resolvedRects = await resolveRegionRects(page, sourceRegions);
    const regions = sourceRegions.map((region, index) => {
      const resolved = resolvedRects[index];
      const box = boxWithPadding(resolved.rect, resolvePadding(region), width, height);
      return {
        id: String(region.id),
        role: region.role ? String(region.role) : null,
        state: region.state ? String(region.state) : null,
        selector: region.selector ? String(region.selector) : null,
        text: region.text ? String(region.text) : null,
        match: region.match ? String(region.match) : null,
        viewport: region.viewport ? String(region.viewport) : `${width}x${height}`,
        source: resolved.source,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    });
    const output = {
      target: options.target,
      width,
      height,
      regions,
    };
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(output, null, 2)}\n`);
    return {
      output: path.resolve(options.output),
      target: options.target,
      width,
      height,
      regionCount: regions.length,
      regions,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await generateRegionManifest({
    target: required(args, "target"),
    source: required(args, "source"),
    output: required(args, "output"),
    width: parsePositiveInt(args.width || "1280", "width"),
    height: parsePositiveInt(args.height || "720", "height"),
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  boxWithPadding,
  generateRegionManifest,
  normalizeText,
  readSourceRegions,
  resolvePadding,
  resolveRegionRects,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
