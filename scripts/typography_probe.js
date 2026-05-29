#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  parseArgs,
  parsePositiveInt,
  targetToUrl,
} = require("./visual_compare");

function required(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required --${key}`);
  }
  return args[key];
}

function cssPx(value) {
  const match = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

function round2(value) {
  return Number(value.toFixed(2));
}

function pxString(value) {
  return `${Math.round(value)}px`;
}

function ratioString(lineHeightPx, fontSizePx) {
  if (!lineHeightPx || !fontSizePx) return null;
  return String(round2(lineHeightPx / fontSizePx));
}

function uniq(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && value !== "")));
}

function normalizeFontFamily(fontFamily) {
  const raw = String(fontFamily || "").trim();
  if (!raw) return null;
  const first = raw.split(",")[0].trim();
  const unquoted = first.replace(/^['"]|['"]$/g, "");
  if (!unquoted || /^(serif|sans-serif|monospace|system-ui)$/i.test(unquoted)) return raw;
  if (/open sans/i.test(unquoted)) return '"Open Sans", Arial, sans-serif';
  if (/\s/.test(unquoted)) return `"${unquoted}", ${raw.includes("sans-serif") ? "Arial, sans-serif" : "serif"}`;
  return raw;
}

function nearbyPx(value, step, radius, minValue = 1) {
  if (!Number.isFinite(value)) return [];
  const values = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const next = Math.max(minValue, value + (offset * step));
    values.push(pxString(next));
  }
  return uniq(values);
}

function nearbyRatio(value, step, radius, minValue = 0.8) {
  if (!Number.isFinite(value)) return [];
  const values = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    values.push(String(round2(Math.max(minValue, value + (offset * step)))));
  }
  return uniq(values);
}

function nearbyWeights(value) {
  const weight = Number.parseInt(value, 10);
  if (!Number.isFinite(weight)) return ["300", "400", "500", "600", "700"];
  return uniq([
    String(Math.max(100, weight - 200)),
    String(Math.max(100, weight - 100)),
    String(weight),
    String(Math.min(900, weight + 100)),
    String(Math.min(900, weight + 200)),
  ]);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mergeParameter(existing, additions) {
  return uniq([...(existing || []), ...additions]);
}

function buildSearchSpace(typography, baseSearchSpace = { baseline: {}, parameters: {} }) {
  const baseline = { ...(baseSearchSpace.baseline || {}) };
  const parameters = { ...(baseSearchSpace.parameters || {}) };
  const roles = typography.roles || {};
  const body = roles.body || roles.paragraph || {};
  const heading = roles.heading || {};
  const button = roles.button || {};

  const bodyFontSize = cssPx(body.fontSize);
  const bodyLineHeight = cssPx(body.lineHeight);
  const headingFontSize = cssPx(heading.fontSize);
  const headingLineHeight = cssPx(heading.lineHeight);
  const buttonFontSize = cssPx(button.fontSize);
  const buttonLineHeight = cssPx(button.lineHeight);
  const normalizedFamily = normalizeFontFamily(body.fontFamily);

  if (normalizedFamily) {
    baseline.fontFamily = normalizedFamily;
    parameters.fontFamily = mergeParameter(parameters.fontFamily, [
      normalizedFamily,
      baseline.fontFamily,
      "Arial, Helvetica, sans-serif",
      '"Open Sans", Arial, sans-serif',
    ]);
  }

  if (bodyFontSize) {
    baseline.bodyFontSize = pxString(bodyFontSize);
    parameters.bodyFontSize = mergeParameter(parameters.bodyFontSize, nearbyPx(bodyFontSize, 1, 2, 8));
  }

  if (body.fontWeight) {
    baseline.bodyFontWeight = String(body.fontWeight);
    parameters.bodyFontWeight = mergeParameter(parameters.bodyFontWeight, nearbyWeights(body.fontWeight));
  }

  const bodyRatio = ratioString(bodyLineHeight, bodyFontSize);
  if (bodyRatio) {
    baseline.bodyLineHeight = bodyRatio;
    parameters.bodyLineHeight = mergeParameter(parameters.bodyLineHeight, nearbyRatio(Number.parseFloat(bodyRatio), 0.05, 3));
  }

  if (headingFontSize) {
    baseline.h1FontSize = pxString(headingFontSize);
    parameters.h1FontSize = mergeParameter(parameters.h1FontSize, nearbyPx(headingFontSize, 1, 3, 8));
  }

  if (heading.fontWeight) {
    baseline.h1FontWeight = String(heading.fontWeight);
    parameters.h1FontWeight = mergeParameter(parameters.h1FontWeight, nearbyWeights(heading.fontWeight));
  }

  const headingRatio = ratioString(headingLineHeight, headingFontSize);
  if (headingRatio) {
    baseline.h1LineHeight = headingRatio;
    parameters.h1LineHeight = mergeParameter(parameters.h1LineHeight, nearbyRatio(Number.parseFloat(headingRatio), 0.05, 3));
  }

  if (buttonFontSize) {
    baseline.buttonFontSize = pxString(buttonFontSize);
    baseline.smallButtonFontSize = pxString(buttonFontSize);
    parameters.buttonFontSize = mergeParameter(parameters.buttonFontSize, nearbyPx(buttonFontSize, 1, 3, 8));
    parameters.smallButtonFontSize = mergeParameter(parameters.smallButtonFontSize, nearbyPx(buttonFontSize, 1, 3, 8));
  }

  if (button.fontWeight) {
    parameters.buttonFontWeight = mergeParameter(parameters.buttonFontWeight, nearbyWeights(button.fontWeight));
  }

  const buttonRatio = ratioString(buttonLineHeight, buttonFontSize);
  if (buttonRatio) {
    baseline.buttonLineHeight = buttonRatio;
    parameters.buttonLineHeight = mergeParameter(parameters.buttonLineHeight, nearbyRatio(Number.parseFloat(buttonRatio), 0.05, 3));
  }

  return { baseline, parameters };
}

async function inspectTypography(target, width, height) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch (error) {
    throw new Error("Typography probing requires the playwright package. Use an environment with playwright installed.");
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(targetToUrl(target), { waitUntil: "networkidle" });
    return await page.evaluate(() => {
      function visible(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }

      function styleOf(selector) {
        const elements = Array.from(document.querySelectorAll(selector)).filter(visible);
        if (!elements.length) return null;
        const el = elements[0];
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          selector,
          text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          color: style.color,
          width: rect.width,
          height: rect.height,
        };
      }

      const fontFaces = [];
      if (document.fonts) {
        for (const fontFace of document.fonts) {
          fontFaces.push({
            family: fontFace.family,
            style: fontFace.style,
            weight: fontFace.weight,
            status: fontFace.status,
          });
        }
      }

      return {
        roles: {
          body: styleOf("body"),
          heading: styleOf("h1,h2,h3,[role='heading']"),
          paragraph: styleOf("p"),
          button: styleOf("a,button,[role='button']"),
        },
        fontFaces,
      };
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = required(args, "target");
  const output = required(args, "output");
  const baseSearchSpace = args["base-search-space"] ? readJson(args["base-search-space"]) : { baseline: {}, parameters: {} };
  const width = parsePositiveInt(args.width || "1280", "width");
  const height = parsePositiveInt(args.height || "720", "height");
  const typography = await inspectTypography(target, width, height);
  const searchSpace = buildSearchSpace(typography, baseSearchSpace);
  const summary = {
    target: path.resolve(target),
    width,
    height,
    typography,
    searchSpace,
  };
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(searchSpace, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  buildSearchSpace,
  cssPx,
  inspectTypography,
  normalizeFontFamily,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
