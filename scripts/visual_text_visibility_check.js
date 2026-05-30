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

function parseFiniteNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function readManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));
  const texts = Array.isArray(manifest) ? manifest : manifest && manifest.texts;
  if (!Array.isArray(texts) || !texts.length) {
    throw new Error("--manifest must be a JSON array or an object with a non-empty texts array");
  }
  return texts.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Text item ${index + 1} must be an object`);
    }
    if (!item.id) {
      throw new Error(`Text item ${index + 1} requires an id`);
    }
    if (!item.selector && item.text === undefined) {
      throw new Error(`Text item ${item.id} requires selector or text`);
    }
    const match = item.match || "contains";
    if (!["contains", "exact"].includes(match)) {
      throw new Error(`Text item ${item.id} match must be contains or exact`);
    }
    const normalized = {
      id: String(item.id),
      selector: item.selector ? String(item.selector) : null,
      text: item.text === undefined ? null : String(item.text),
      match,
      minContrast: item.minContrast === undefined ? null : parseFiniteNumber(item.minContrast, `Text item ${item.id} minContrast`),
      expectedLineCount: item.expectedLineCount === undefined ? null : parsePositiveInt(String(item.expectedLineCount), `Text item ${item.id} expectedLineCount`),
    };
    if (item.lineCount !== undefined) {
      normalized.expectedLineCount = parsePositiveInt(String(item.lineCount), `Text item ${item.id} lineCount`);
    }
    return normalized;
  });
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

function summarizeFailure(item) {
  return `${item.id}: ${item.failures.join("; ")}`;
}

async function runTextVisibilityCheck(options) {
  const items = readManifest(options.manifest);
  const { browser, page } = await createBrowserPage(options.width, options.height);
  try {
    await page.goto(targetToUrl(options.target), { waitUntil: "networkidle" });
    const results = await page.evaluate(({ checks, minContrast }) => {
      const transparent = /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i;

      function normalize(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }

      function matchesText(actual, expected, match) {
        if (expected === null) return true;
        const normalizedActual = normalize(actual);
        const normalizedExpected = normalize(expected);
        return match === "exact"
          ? normalizedActual === normalizedExpected
          : normalizedActual.includes(normalizedExpected);
      }

      function cssPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
        if (element.id) return `#${CSS.escape(element.id)}`;
        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          const tag = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          const index = siblings.indexOf(current) + 1;
          parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
          current = parent;
        }
        return parts.join(" > ");
      }

      function findByText(item) {
        const elements = Array.from(document.body ? document.body.querySelectorAll("*") : []);
        const candidates = elements.filter((element) => {
          const tag = element.tagName.toLowerCase();
          if (["script", "style", "noscript", "template"].includes(tag)) return false;
          const text = element.innerText || element.textContent || "";
          return matchesText(text, item.text, item.match);
        });
        candidates.sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return (leftRect.width * leftRect.height) - (rightRect.width * rightRect.height);
        });
        return candidates[0] || null;
      }

      function parseColor(value) {
        const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
        if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;
        return {
          r: parts[0],
          g: parts[1],
          b: parts[2],
          a: parts[3] === undefined || !Number.isFinite(parts[3]) ? 1 : parts[3],
        };
      }

      function relativeLuminance(channel) {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      }

      function contrastRatio(foreground, background) {
        if (!foreground || !background) return null;
        const foregroundLuminance = 0.2126 * relativeLuminance(foreground.r)
          + 0.7152 * relativeLuminance(foreground.g)
          + 0.0722 * relativeLuminance(foreground.b);
        const backgroundLuminance = 0.2126 * relativeLuminance(background.r)
          + 0.7152 * relativeLuminance(background.g)
          + 0.0722 * relativeLuminance(background.b);
        const light = Math.max(foregroundLuminance, backgroundLuminance);
        const dark = Math.min(foregroundLuminance, backgroundLuminance);
        return (light + 0.05) / (dark + 0.05);
      }

      function nearestBackground(element) {
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const color = window.getComputedStyle(current).backgroundColor;
          if (color && !transparent.test(color)) {
            const parsed = parseColor(color);
            if (parsed && parsed.a > 0) return parsed;
          }
          current = current.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      }

      function overflowClips(style) {
        return [style.overflow, style.overflowX, style.overflowY].some((value) => {
          return ["hidden", "clip", "scroll", "auto"].includes(String(value || "").toLowerCase());
        });
      }

      function isRectInside(inner, outer) {
        const epsilon = 0.5;
        return inner.left >= outer.left - epsilon
          && inner.top >= outer.top - epsilon
          && inner.right <= outer.right + epsilon
          && inner.bottom <= outer.bottom + epsilon;
      }

      function clippingFailure(element, rect) {
        const viewport = {
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        };
        if (!isRectInside(rect, viewport)) {
          return "clipped by viewport";
        }
        let current = element.parentElement;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const style = window.getComputedStyle(current);
          if (overflowClips(style)) {
            const ancestorRect = current.getBoundingClientRect();
            if (!isRectInside(rect, ancestorRect)) {
              return `clipped by ${cssPath(current) || current.tagName.toLowerCase()}`;
            }
          }
          current = current.parentElement;
        }
        return null;
      }

      function lineBoxes(element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        range.detach();
        return rects;
      }

      function evaluateItem(item) {
        const failures = [];
        let element = null;
        if (item.selector) {
          element = document.querySelector(item.selector);
        }
        if (!element && item.text !== null) {
          element = findByText(item);
        }
        if (!element) {
          return {
            id: item.id,
            ok: false,
            exists: false,
            selector: item.selector,
            text: item.text,
            failures: ["element not found"],
          };
        }

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const rects = Array.from(element.getClientRects()).filter((entry) => entry.width > 0 && entry.height > 0);
        const lineRects = lineBoxes(element);
        const text = element.innerText || element.textContent || "";
        const textMatches = matchesText(text, item.text, item.match);
        const hidden = style.display === "none"
          || style.visibility === "hidden"
          || Number.parseFloat(style.opacity || "1") === 0;
        const hasNonzeroRect = rects.length > 0 && rect.width > 0 && rect.height > 0;
        const clipping = hasNonzeroRect ? clippingFailure(element, rect) : null;
        let covering = null;
        if (hasNonzeroRect) {
          const centerX = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
          const centerY = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
          const topElement = document.elementFromPoint(centerX, centerY);
          if (topElement && topElement !== element && !element.contains(topElement)) {
            covering = `covered by ${cssPath(topElement) || topElement.tagName.toLowerCase()}`;
          }
        }
        const contrast = contrastRatio(parseColor(style.color), nearestBackground(element));
        const requiredContrast = item.minContrast === null ? minContrast : item.minContrast;

        if (!textMatches) failures.push(`text does not match ${item.text}`);
        if (hidden) failures.push("hidden by display, visibility, or opacity");
        if (!hasNonzeroRect) failures.push("no nonzero client rect");
        if (clipping) failures.push(clipping);
        if (covering) failures.push(covering);
        if (contrast !== null && requiredContrast !== null && contrast < requiredContrast) {
          failures.push(`contrast ${contrast.toFixed(2)} below ${requiredContrast}`);
        }
        if (item.expectedLineCount !== null && lineRects.length !== item.expectedLineCount) {
          failures.push(`lineBoxCount ${lineRects.length} does not equal ${item.expectedLineCount}`);
        }

        return {
          id: item.id,
          ok: failures.length === 0,
          exists: true,
          selector: item.selector || cssPath(element),
          text: item.text,
          actualText: normalize(text),
          textMatches,
          hidden,
          hasNonzeroRect,
          clipped: Boolean(clipping),
          covered: Boolean(covering),
          cover: covering,
          contrast: contrast === null ? null : Number(contrast.toFixed(2)),
          minContrast: requiredContrast,
          lineBoxCount: lineRects.length,
          expectedLineCount: item.expectedLineCount,
          rect: {
            x: Number(rect.x.toFixed(2)),
            y: Number(rect.y.toFixed(2)),
            width: Number(rect.width.toFixed(2)),
            height: Number(rect.height.toFixed(2)),
          },
          failures,
        };
      }

      return checks.map(evaluateItem);
    }, {
      checks: items,
      minContrast: options.minContrast,
    });

    const failedItems = results.filter((item) => !item.ok);
    const summary = {
      ok: failedItems.length === 0,
      target: options.target,
      manifest: options.manifest,
      width: options.width,
      height: options.height,
      minContrast: options.minContrast,
      passed: results.length - failedItems.length,
      failed: failedItems.length,
      items: results,
    };
    if (options.output) {
      fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
      fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(summary, null, 2)}\n`);
    }
    return summary;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = required(args, "target");
  const manifest = required(args, "manifest");
  const width = parsePositiveInt(args.width || "1280", "width");
  const height = parsePositiveInt(args.height || "720", "height");
  const minContrast = args["min-contrast"] === undefined
    ? 3
    : parseFiniteNumber(args["min-contrast"], "--min-contrast");

  const summary = await runTextVisibilityCheck({
    target,
    manifest,
    output: args.output || null,
    width,
    height,
    minContrast,
  });

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.ok) {
    for (const item of summary.items.filter((entry) => !entry.ok)) {
      process.stderr.write(`${summarizeFailure(item)}\n`);
    }
    process.exit(1);
  }
}

module.exports = {
  readManifest,
  runTextVisibilityCheck,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
