#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "require-tesseract") {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`--${key} requires a value`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function pass(name, message, details = {}) {
  return { name, ok: true, message, details };
}

function fail(name, message, details = {}) {
  return { name, ok: false, message, details };
}

function checkPackage(name, moduleName = name) {
  try {
    const resolved = require.resolve(moduleName);
    return pass(name, `${moduleName} is available`, { resolved });
  } catch (error) {
    return fail(name, `${moduleName} is not available`, { error: error.message });
  }
}

function readPngSize(file) {
  const buffer = fs.readFileSync(path.resolve(file));
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height };
}

function checkImageDimensions(reference, candidate) {
  if (!reference && !candidate) return null;
  if (!reference || !candidate) {
    return fail("image-dimensions", "both --reference and --candidate are required for dimension checks", {
      reference: reference || null,
      candidate: candidate || null,
    });
  }
  try {
    const referenceSize = readPngSize(reference);
    const candidateSize = readPngSize(candidate);
    const same =
      referenceSize.width === candidateSize.width &&
      referenceSize.height === candidateSize.height;
    return same
      ? pass("image-dimensions", "reference and candidate image dimensions match", {
          reference: referenceSize,
          candidate: candidateSize,
        })
      : fail("image-dimensions", "reference and candidate image dimensions differ", {
          reference: referenceSize,
          candidate: candidateSize,
        });
  } catch (error) {
    return fail("image-dimensions", "could not read PNG dimensions", { error: error.message });
  }
}

function checkTesseract(bin, required) {
  if (!required && !bin) return null;
  const executable = bin || "tesseract";
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error) {
    return fail("tesseract", `${executable} is not available`, { error: result.error.message });
  }
  if (result.status !== 0) {
    return fail("tesseract", `${executable} did not run successfully`, {
      status: result.status,
      stderr: result.stderr,
    });
  }
  return pass("tesseract", `${executable} is available`, {
    version: String(result.stdout || result.stderr).split(/\r?\n/)[0],
  });
}

function targetToUrl(target) {
  if (/^(https?:|file:)/i.test(target)) return target;
  return pathToFileURL(path.resolve(target)).href;
}

async function checkTargetRender(target) {
  if (!target) return null;
  let playwright;
  try {
    playwright = require("playwright");
  } catch (error) {
    return fail("target-render", "playwright is not available for target rendering", {
      error: error.message,
    });
  }

  const consoleErrors = [];
  const requestFailures = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        error: request.failure()?.errorText || "request failed",
      });
    });
    const response = await page.goto(targetToUrl(target), {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    const status = response ? response.status() : null;
    const viewport = page.viewportSize();
    const ok = status === null || status < 400;
    if (!ok || consoleErrors.length || requestFailures.length) {
      return fail("target-render", "target rendered with blocking errors", {
        target,
        status,
        viewport,
        consoleErrors,
        requestFailures,
      });
    }
    return pass("target-render", "target rendered without blocking errors", {
      target,
      status,
      viewport,
    });
  } catch (error) {
    return fail("target-render", "target did not render", { target, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
}

function writeSummary(output, summary) {
  if (!output) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  const outPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [
    pass("node", "node runtime is available", { version: process.version }),
    checkPackage("playwright-package", "playwright"),
    checkPackage("pngjs-package", "pngjs"),
  ];

  const tesseractCheck = checkTesseract(args["tesseract-bin"], Boolean(args["require-tesseract"]));
  if (tesseractCheck) checks.push(tesseractCheck);

  const imageCheck = checkImageDimensions(args.reference, args.candidate);
  if (imageCheck) checks.push(imageCheck);

  const targetCheck = await checkTargetRender(args.target);
  if (targetCheck) checks.push(targetCheck);

  const summary = {
    ok: checks.every((check) => check.ok),
    checks,
  };
  writeSummary(args.output, summary);
  if (!summary.ok) process.exitCode = 1;
}

main().catch((error) => {
  const summary = {
    ok: false,
    checks: [fail("preflight", error.message)],
  };
  try {
    const args = parseArgs(process.argv.slice(2));
    writeSummary(args.output, summary);
  } catch {
    process.stderr.write(`${error.stack || error.message}\n`);
  }
  process.exitCode = 1;
});
