#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const sharp = require("sharp");
const pixelmatchModule = require("pixelmatch");
const { PNG } = require("pngjs");

const pixelmatch = pixelmatchModule.default || pixelmatchModule;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

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

function parseThreshold(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("--threshold must be a number between 0 and 1");
  }
  return parsed;
}

function parseFiniteNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function targetToUrl(target) {
  if (/^https?:\/\//i.test(target) || /^file:\/\//i.test(target)) {
    return target;
  }
  return pathToFileURL(path.resolve(target)).toString();
}

async function withPage(target, width, height, callback) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch (error) {
    throw new Error("Rendering requires the playwright package. Use an environment with playwright installed.");
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.goto(targetToUrl(target), { waitUntil: "networkidle" });
    return await callback(page);
  } finally {
    await browser.close();
  }
}

async function renderTarget(target, output, width, height) {
  await withPage(target, width, height, async (page) => {
    await page.screenshot({ path: output, fullPage: false });
  });
}

async function normalizePng(input, width, height) {
  const buffer = await sharp(input)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .png()
    .toBuffer();
  return PNG.sync.read(buffer);
}

async function readImageSize(input) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions for ${input}`);
  }
  return { width: metadata.width, height: metadata.height };
}

async function validateImageDimensions(reference, candidate, width, height) {
  const [referenceSize, candidateSize] = await Promise.all([
    readImageSize(reference),
    readImageSize(candidate),
  ]);
  const requestedSize = `${width}x${height}`;
  const referenceLabel = `${referenceSize.width}x${referenceSize.height}`;
  const candidateLabel = `${candidateSize.width}x${candidateSize.height}`;
  if (referenceSize.width !== candidateSize.width || referenceSize.height !== candidateSize.height) {
    throw new Error(`Image dimensions must match before scoring: reference is ${referenceLabel}, candidate is ${candidateLabel}, requested viewport is ${requestedSize}`);
  }
  if (referenceSize.width !== width || referenceSize.height !== height) {
    throw new Error(`Image dimensions must match requested viewport before scoring: images are ${referenceLabel}, requested viewport is ${requestedSize}`);
  }
  return {
    dimensionsMatch: true,
    reference: referenceSize,
    candidate: candidateSize,
    requested: { width, height },
  };
}

function readMaskManifest(maskManifestPath) {
  if (!maskManifestPath) {
    return [];
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(maskManifestPath), "utf8"));
  if (Array.isArray(manifest)) {
    return manifest;
  }
  if (manifest && Array.isArray(manifest.masks)) {
    return manifest.masks;
  }
  throw new Error("--mask-manifest must be a JSON array or an object with a masks array");
}

function normalizeMaskManifest(maskManifestPath, width, height) {
  const masks = readMaskManifest(maskManifestPath);
  const occupiedPixels = new Set();
  const normalized = masks.map((mask, index) => {
    if (!mask || typeof mask !== "object") {
      throw new Error(`Mask ${index + 1} must be an object`);
    }
    const id = mask.id ? String(mask.id) : `mask-${index + 1}`;
    const x = parseFiniteNumber(mask.x, `mask ${id} x`);
    const y = parseFiniteNumber(mask.y, `mask ${id} y`);
    const maskWidth = parseFiniteNumber(mask.width, `mask ${id} width`);
    const maskHeight = parseFiniteNumber(mask.height, `mask ${id} height`);
    if (x < 0 || y < 0) {
      throw new Error(`Mask ${id} x and y must be non-negative`);
    }
    if (maskWidth <= 0 || maskHeight <= 0) {
      throw new Error(`Mask ${id} width and height must be positive`);
    }
    if (x + maskWidth > width || y + maskHeight > height) {
      throw new Error(`Mask ${id} must stay within image bounds ${width}x${height}`);
    }
    const left = Math.floor(x);
    const top = Math.floor(y);
    const right = Math.ceil(x + maskWidth);
    const bottom = Math.ceil(y + maskHeight);
    const pixelKeys = [];
    for (let row = top; row < bottom; row += 1) {
      for (let column = left; column < right; column += 1) {
        const key = `${column},${row}`;
        if (occupiedPixels.has(key) && !mask.allowOverlap) {
          throw new Error(`Mask ${id} overlaps another mask; set allowOverlap when intentional`);
        }
        pixelKeys.push(key);
      }
    }
    for (const key of pixelKeys) {
      occupiedPixels.add(key);
    }
    return {
      id,
      x,
      y,
      width: maskWidth,
      height: maskHeight,
      pixelBounds: { left, top, right, bottom },
      pixels: pixelKeys.length,
      reason: mask.reason ? String(mask.reason) : null,
    };
  });
  return {
    masks: normalized,
    maskedPixelKeys: occupiedPixels,
    maskedPixelCount: occupiedPixels.size,
    maskedPixelRatio: Number((occupiedPixels.size / (width * height)).toFixed(4)),
  };
}

function readRegionManifest(regionManifestPath) {
  if (!regionManifestPath) {
    return [];
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(regionManifestPath), "utf8"));
  if (Array.isArray(manifest)) {
    return manifest;
  }
  if (manifest && Array.isArray(manifest.regions)) {
    return manifest.regions;
  }
  throw new Error("--region-manifest must be a JSON array or an object with a regions array");
}

function normalizeRegionManifest(regionManifestPath, width, height) {
  const regions = readRegionManifest(regionManifestPath);
  return regions.map((region, index) => {
    if (!region || typeof region !== "object") {
      throw new Error(`Region ${index + 1} must be an object`);
    }
    if (!region.id) {
      throw new Error(`Region ${index + 1} requires an id`);
    }
    const id = String(region.id);
    const x = parseFiniteNumber(region.x, `region ${id} x`);
    const y = parseFiniteNumber(region.y, `region ${id} y`);
    const regionWidth = parseFiniteNumber(region.width, `region ${id} width`);
    const regionHeight = parseFiniteNumber(region.height, `region ${id} height`);
    if (x < 0 || y < 0) {
      throw new Error(`Region ${id} x and y must be non-negative`);
    }
    if (regionWidth <= 0 || regionHeight <= 0) {
      throw new Error(`Region ${id} width and height must be positive`);
    }
    if (x + regionWidth > width || y + regionHeight > height) {
      throw new Error(`Region ${id} must stay within image bounds ${width}x${height}`);
    }
    const left = Math.floor(x);
    const top = Math.floor(y);
    const right = Math.ceil(x + regionWidth);
    const bottom = Math.ceil(y + regionHeight);
    return {
      id,
      role: region.role ? String(region.role) : null,
      state: region.state ? String(region.state) : null,
      selector: region.selector ? String(region.selector) : null,
      viewport: region.viewport ? String(region.viewport) : null,
      x,
      y,
      width: regionWidth,
      height: regionHeight,
      pixelBounds: { left, top, right, bottom },
      pixels: Math.max(0, right - left) * Math.max(0, bottom - top),
    };
  });
}

function copyReferencePixelsIntoMaskedRegions(referencePng, candidatePng, masks, width) {
  const maskedCandidateData = Buffer.from(candidatePng.data);
  for (const mask of masks) {
    const bounds = mask.pixelBounds;
    for (let row = bounds.top; row < bounds.bottom; row += 1) {
      for (let column = bounds.left; column < bounds.right; column += 1) {
        const offset = ((row * width) + column) * 4;
        maskedCandidateData[offset] = referencePng.data[offset];
        maskedCandidateData[offset + 1] = referencePng.data[offset + 1];
        maskedCandidateData[offset + 2] = referencePng.data[offset + 2];
        maskedCandidateData[offset + 3] = referencePng.data[offset + 3];
      }
    }
  }
  return maskedCandidateData;
}

function percentOfTotal(pixels, totalPixels) {
  return Number(((pixels / totalPixels) * 100).toFixed(2));
}

function scoreRegionCrop(referencePng, candidatePng, region, threshold) {
  const bounds = region.pixelBounds;
  const cropWidth = bounds.right - bounds.left;
  const cropHeight = bounds.bottom - bounds.top;
  const referenceCrop = Buffer.alloc(cropWidth * cropHeight * 4);
  const candidateCrop = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let row = bounds.top; row < bounds.bottom; row += 1) {
    for (let column = bounds.left; column < bounds.right; column += 1) {
      const sourceOffset = ((row * referencePng.width) + column) * 4;
      const cropOffset = ((((row - bounds.top) * cropWidth) + (column - bounds.left)) * 4);
      referenceCrop[cropOffset] = referencePng.data[sourceOffset];
      referenceCrop[cropOffset + 1] = referencePng.data[sourceOffset + 1];
      referenceCrop[cropOffset + 2] = referencePng.data[sourceOffset + 2];
      referenceCrop[cropOffset + 3] = referencePng.data[sourceOffset + 3];
      candidateCrop[cropOffset] = candidatePng.data[sourceOffset];
      candidateCrop[cropOffset + 1] = candidatePng.data[sourceOffset + 1];
      candidateCrop[cropOffset + 2] = candidatePng.data[sourceOffset + 2];
      candidateCrop[cropOffset + 3] = candidatePng.data[sourceOffset + 3];
    }
  }
  const diffCrop = new PNG({ width: cropWidth, height: cropHeight });
  const mismatchedPixels = pixelmatch(
    referenceCrop,
    candidateCrop,
    diffCrop.data,
    cropWidth,
    cropHeight,
    { threshold }
  );
  const totalPixels = cropWidth * cropHeight;
  return {
    id: region.id,
    role: region.role,
    state: region.state,
    selector: region.selector,
    viewport: region.viewport,
    mismatchedPixels,
    totalPixels,
    mismatchPercent: percentOfTotal(mismatchedPixels, totalPixels),
    box: {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      pixelBounds: region.pixelBounds,
    },
  };
}

function scoreRegionGeometry(regions) {
  return regions.map((region) => ({
    id: region.id,
    role: region.role,
    state: region.state,
    selector: region.selector,
    viewport: region.viewport,
    referenceBox: {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    },
    candidateBox: {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    },
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
    centerDelta: 0,
  }));
}

async function compareImages(options) {
  const reference = path.resolve(options.reference);
  const candidate = path.resolve(options.candidate);
  const diff = path.resolve(options.diff);
  const width = options.width;
  const height = options.height;

  const dimensionSanity = await validateImageDimensions(reference, candidate, width, height);
  const maskSanity = normalizeMaskManifest(options.maskManifest, width, height);
  const regions = normalizeRegionManifest(options.regionManifest, width, height);
  const referencePng = await normalizePng(reference, width, height);
  const candidatePng = await normalizePng(candidate, width, height);
  const diffPng = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(
    referencePng.data,
    candidatePng.data,
    diffPng.data,
    width,
    height,
    { threshold: options.threshold }
  );

  fs.mkdirSync(path.dirname(diff), { recursive: true });
  fs.writeFileSync(diff, PNG.sync.write(diffPng));

  const totalPixels = width * height;
  let uiMaskedMismatchedPixels = mismatchedPixels;
  if (maskSanity.masks.length) {
    const maskedCandidateData = copyReferencePixelsIntoMaskedRegions(referencePng, candidatePng, maskSanity.masks, width);
    const maskedDiffPng = new PNG({ width, height });
    uiMaskedMismatchedPixels = pixelmatch(
      referencePng.data,
      maskedCandidateData,
      maskedDiffPng.data,
      width,
      height,
      { threshold: options.threshold }
    );
  }
  const fullPageMismatch = percentOfTotal(mismatchedPixels, totalPixels);
  const uiMaskedMismatch = percentOfTotal(uiMaskedMismatchedPixels, totalPixels);
  const scoreInvariantOk = (
    uiMaskedMismatch >= 0 &&
    fullPageMismatch >= 0 &&
    uiMaskedMismatch <= fullPageMismatch &&
    fullPageMismatch <= 100
  );
  const regionMismatch = regions.map((region) => scoreRegionCrop(referencePng, candidatePng, region, options.threshold));
  const regionGeometry = scoreRegionGeometry(regions);
  const localCropMismatch = regionMismatch.length
    ? [...regionMismatch].sort((a, b) => b.mismatchPercent - a.mismatchPercent)[0]
    : null;
  return {
    reference,
    candidate,
    diff,
    width,
    height,
    threshold: options.threshold,
    mismatchedPixels,
    totalPixels,
    mismatchPercent: fullPageMismatch,
    fullPageMismatch,
    uiMaskedMismatchedPixels,
    uiMaskedMismatch,
    regionMismatch,
    regionGeometry,
    localCropMismatch,
    sanity: {
      dimensionsMatch: dimensionSanity.dimensionsMatch,
      maskCount: maskSanity.masks.length,
      maskedPixelCount: maskSanity.maskedPixelCount,
      maskedPixelRatio: maskSanity.maskedPixelRatio,
      regionCount: regions.length,
      masks: maskSanity.masks.map((mask) => ({
        id: mask.id,
        x: mask.x,
        y: mask.y,
        width: mask.width,
        height: mask.height,
        pixelBounds: mask.pixelBounds,
        pixels: mask.pixels,
        reason: mask.reason,
      })),
      scoreInvariantOk,
    },
  };
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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
  return Number(((2 * lcsLength(left, right)) / (left.length + right.length)).toFixed(4));
}

function parseRgb(value) {
  const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;
  return {
    r: parts[0],
    g: parts[1],
    b: parts[2],
    a: parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1,
  };
}

function colorSimilarity(a, b) {
  const left = parseRgb(a);
  const right = parseRgb(b);
  if (!left || !right) return null;
  if (left.a < 0.05 && right.a < 0.05) return null;
  const distance = Math.sqrt(
    ((left.r - right.r) ** 2) +
    ((left.g - right.g) ** 2) +
    ((left.b - right.b) ** 2)
  );
  return Math.max(0, Number((1 - (distance / Math.sqrt(3 * (255 ** 2)))).toFixed(4)));
}

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!usable.length) return null;
  return Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(4));
}

async function inspectTarget(target, width, height) {
  return await withPage(target, width, height, async (page) => {
    return await page.evaluate(() => {
      const textTags = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "A", "BUTTON", "LABEL", "LI", "TD", "TH", "SPAN", "STRONG"]);
      const blocks = [];
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const elements = Array.from(document.body.querySelectorAll("*"));
      for (const element of elements) {
        const tag = element.tagName;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") === 0) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const text = normalize(element.innerText || element.getAttribute("alt") || element.getAttribute("aria-label") || "");
        const directText = normalize(Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join(" "));
        const isImage = tag === "IMG";
        const includeText = text && textTags.has(tag);
        const wrapsSingleEquivalentChild = !directText && Array.from(element.children).some((child) => {
          if (!textTags.has(child.tagName) && child.tagName !== "IMG") return false;
          return normalize(child.innerText || child.getAttribute("alt") || child.getAttribute("aria-label") || "") === text;
        });
        if (!isImage && !includeText) continue;
        if (wrapsSingleEquivalentChild && tag !== "A" && tag !== "BUTTON") continue;
        blocks.push({
          tag: tag.toLowerCase(),
          kind: isImage ? "image" : "text",
          text,
          x: Number(rect.x.toFixed(2)),
          y: Number(rect.y.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        });
      }
      return {
        text: normalize(document.body.innerText || ""),
        blocks,
      };
    });
  });
}

function matchBlocks(referenceBlocks, candidateBlocks) {
  const matches = [];
  const usedCandidateIndexes = new Set();
  for (let i = 0; i < referenceBlocks.length; i += 1) {
    const referenceBlock = referenceBlocks[i];
    let best = null;
    for (let j = 0; j < candidateBlocks.length; j += 1) {
      if (usedCandidateIndexes.has(j)) continue;
      const candidateBlock = candidateBlocks[j];
      if (referenceBlock.kind !== candidateBlock.kind) continue;
      const similarity = referenceBlock.kind === "image"
        ? (referenceBlock.tag === candidateBlock.tag ? 1 : 0)
        : textSimilarity(referenceBlock.text, candidateBlock.text);
      if (similarity < 0.45) continue;
      if (!best || similarity > best.similarity) {
        best = { referenceIndex: i, candidateIndex: j, similarity, referenceBlock, candidateBlock };
      }
    }
    if (best) {
      usedCandidateIndexes.add(best.candidateIndex);
      matches.push(best);
    }
  }
  return matches;
}

function scoreLayout(matches, width, height) {
  const diagonal = Math.sqrt((width ** 2) + (height ** 2));
  const scored = matches.map((match) => {
    const ref = match.referenceBlock;
    const cand = match.candidateBlock;
    const refCenterX = ref.x + (ref.width / 2);
    const refCenterY = ref.y + (ref.height / 2);
    const candCenterX = cand.x + (cand.width / 2);
    const candCenterY = cand.y + (cand.height / 2);
    const centerDistance = Math.sqrt(((refCenterX - candCenterX) ** 2) + ((refCenterY - candCenterY) ** 2));
    const positionScore = Math.max(0, 1 - (centerDistance / diagonal));
    const widthScore = Math.max(0, 1 - (Math.abs(ref.width - cand.width) / Math.max(ref.width, cand.width, 1)));
    const heightScore = Math.max(0, 1 - (Math.abs(ref.height - cand.height) / Math.max(ref.height, cand.height, 1)));
    const sizeScore = (widthScore + heightScore) / 2;
    return {
      text: ref.text.slice(0, 80),
      tag: ref.tag,
      positionScore: Number(positionScore.toFixed(4)),
      sizeScore: Number(sizeScore.toFixed(4)),
      score: Number(((positionScore + sizeScore) / 2).toFixed(4)),
      referenceBox: { x: ref.x, y: ref.y, width: ref.width, height: ref.height },
      candidateBox: { x: cand.x, y: cand.y, width: cand.width, height: cand.height },
    };
  });
  scored.sort((a, b) => a.score - b.score);
  return {
    matchedBlocks: matches.length,
    score: average(scored.map((item) => item.score)),
    positionScore: average(scored.map((item) => item.positionScore)),
    sizeScore: average(scored.map((item) => item.sizeScore)),
    worstMatches: scored.slice(0, 5),
  };
}

function scoreColor(matches) {
  const textScores = [];
  const backgroundScores = [];
  for (const match of matches) {
    const textScore = colorSimilarity(match.referenceBlock.color, match.candidateBlock.color);
    const backgroundScore = colorSimilarity(match.referenceBlock.backgroundColor, match.candidateBlock.backgroundColor);
    if (textScore !== null) textScores.push(textScore);
    if (backgroundScore !== null) backgroundScores.push(backgroundScore);
  }
  const textColorScore = average(textScores);
  const backgroundColorScore = average(backgroundScores);
  return {
    matchedBlocks: matches.length,
    score: average([textColorScore, backgroundColorScore].filter((value) => value !== null)),
    textColorScore,
    backgroundColorScore,
  };
}

async function compareDomDiagnostics(options) {
  const reference = await inspectTarget(options.referenceTarget, options.width, options.height);
  const candidate = await inspectTarget(options.candidateTarget, options.width, options.height);
  const matches = matchBlocks(reference.blocks, candidate.blocks);
  return {
    referenceTarget: options.referenceTarget,
    candidateTarget: options.candidateTarget,
    text: {
      similarity: textSimilarity(reference.text, candidate.text),
      referenceLength: reference.text.length,
      candidateLength: candidate.text.length,
    },
    layout: {
      referenceBlocks: reference.blocks.length,
      candidateBlocks: candidate.blocks.length,
      unmatchedReferenceBlocks: Math.max(0, reference.blocks.length - matches.length),
      unmatchedCandidateBlocks: Math.max(0, candidate.blocks.length - matches.length),
      ...scoreLayout(matches, options.width, options.height),
    },
    color: scoreColor(matches),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reference = required(args, "reference");
  let candidate = args.candidate;
  const target = args.target;
  const diff = required(args, "diff");
  const width = parsePositiveInt(args.width || "1280", "width");
  const height = parsePositiveInt(args.height || "720", "height");
  const threshold = parseThreshold(args.threshold || "0.1");

  if (!candidate && !target) {
    throw new Error("Provide either --candidate image or --target HTML/URL to render");
  }

  if (candidate && target) {
    throw new Error("Use only one of --candidate or --target");
  }

  let rendered = null;
  if (target) {
    rendered = path.resolve(args.rendered || path.join(path.dirname(diff), "rendered-candidate.png"));
    fs.mkdirSync(path.dirname(rendered), { recursive: true });
    await renderTarget(target, rendered, width, height);
    candidate = rendered;
  }

  const summary = await compareImages({
    reference,
    candidate,
    diff,
    width,
    height,
    threshold,
    maskManifest: args["mask-manifest"],
    regionManifest: args["region-manifest"],
  });

  if (rendered) {
    summary.rendered = rendered;
    summary.target = target;
  }

  if (args["reference-html"]) {
    const candidateTarget = args["candidate-html"] || target;
    if (!candidateTarget) {
      throw new Error("--reference-html diagnostics require --target or --candidate-html");
    }
    summary.diagnostics = await compareDomDiagnostics({
      referenceTarget: args["reference-html"],
      candidateTarget,
      width,
      height,
    });
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  compareImages,
  compareDomDiagnostics,
  copyReferencePixelsIntoMaskedRegions,
  inspectTarget,
  normalizeMaskManifest,
  normalizePng,
  normalizeRegionManifest,
  parseArgs,
  parseFiniteNumber,
  parsePositiveInt,
  parseThreshold,
  readImageSize,
  readMaskManifest,
  readRegionManifest,
  renderTarget,
  scoreRegionCrop,
  scoreRegionGeometry,
  textSimilarity,
  targetToUrl,
  validateImageDimensions,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
