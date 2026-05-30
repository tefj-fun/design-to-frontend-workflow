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

function readManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));
  const states = Array.isArray(manifest) ? manifest : manifest && manifest.states;
  if (!Array.isArray(states) || !states.length) {
    throw new Error("--manifest must be a JSON array or an object with a non-empty states array");
  }
  return states.map((state, index) => {
    if (!state || typeof state !== "object") {
      throw new Error(`State ${index + 1} must be an object`);
    }
    if (!state.id) {
      throw new Error(`State ${index + 1} requires an id`);
    }
    return {
      id: String(state.id),
      actions: Array.isArray(state.actions) ? state.actions : [],
      assertions: Array.isArray(state.assertions) ? state.assertions : [],
    };
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

async function settle(page, ms = 50) {
  await page.waitForTimeout(ms);
}

async function runAction(page, action, stateId) {
  if (!action || typeof action !== "object") {
    throw new Error(`State ${stateId} has invalid action`);
  }
  const type = action.type;
  const selector = action.selector;
  if (["click", "hover", "focus", "fill", "press", "waitForSelector"].includes(type) && !selector) {
    throw new Error(`State ${stateId} action ${type} requires selector`);
  }
  if (type === "click") {
    await page.click(selector);
  } else if (type === "hover") {
    await page.hover(selector);
  } else if (type === "focus") {
    await page.focus(selector);
  } else if (type === "fill") {
    await page.fill(selector, String(action.value || ""));
  } else if (type === "press") {
    if (!action.key) throw new Error(`State ${stateId} press action requires key`);
    await page.press(selector, String(action.key));
  } else if (type === "waitForSelector") {
    await page.waitForSelector(selector, {
      state: action.state || "visible",
      timeout: action.timeout || 1000,
    });
  } else if (type === "wait") {
    await page.waitForTimeout(action.ms || 100);
  } else {
    throw new Error(`State ${stateId} has unsupported action type: ${type}`);
  }
  await settle(page, action.settleMs || 50);
}

async function selectorCount(page, selector) {
  return await page.locator(selector).count();
}

async function assertVisible(page, assertion, stateId) {
  const count = await selectorCount(page, assertion.selector);
  if (!count) throw new Error(`State ${stateId} expected ${assertion.selector} to be visible, but selector matched 0 elements`);
  const visible = await page.locator(assertion.selector).first().isVisible();
  if (!visible) throw new Error(`State ${stateId} expected ${assertion.selector} to be visible`);
}

async function assertHidden(page, assertion, stateId) {
  const count = await selectorCount(page, assertion.selector);
  if (!count) return;
  const visible = await page.locator(assertion.selector).first().isVisible();
  if (visible) throw new Error(`State ${stateId} expected ${assertion.selector} to be hidden`);
}

async function assertText(page, assertion, stateId) {
  const count = await selectorCount(page, assertion.selector);
  if (!count) throw new Error(`State ${stateId} expected text selector ${assertion.selector} to exist`);
  const text = String(await page.locator(assertion.selector).first().innerText()).replace(/\s+/g, " ").trim();
  if (assertion.equals !== undefined && text !== String(assertion.equals)) {
    throw new Error(`State ${stateId} expected ${assertion.selector} text to equal ${assertion.equals}, got ${text}`);
  }
  if (assertion.contains !== undefined && !text.includes(String(assertion.contains))) {
    throw new Error(`State ${stateId} expected ${assertion.selector} text to contain ${assertion.contains}, got ${text}`);
  }
}

async function assertFocused(page, assertion, stateId) {
  const focused = await page.evaluate((selector) => document.activeElement === document.querySelector(selector), assertion.selector);
  if (!focused) throw new Error(`State ${stateId} expected ${assertion.selector} to be focused`);
}

async function assertCss(page, assertion, stateId) {
  if (!assertion.property) throw new Error(`State ${stateId} css assertion requires property`);
  const value = await page.locator(assertion.selector).first().evaluate((element, property) => {
    return window.getComputedStyle(element)[property];
  }, assertion.property);
  if (assertion.equals !== undefined && value !== String(assertion.equals)) {
    throw new Error(`State ${stateId} expected ${assertion.selector} ${assertion.property} to equal ${assertion.equals}, got ${value}`);
  }
  if (assertion.contains !== undefined && !String(value).includes(String(assertion.contains))) {
    throw new Error(`State ${stateId} expected ${assertion.selector} ${assertion.property} to contain ${assertion.contains}, got ${value}`);
  }
}

async function assertCount(page, assertion, stateId) {
  const count = await selectorCount(page, assertion.selector);
  if (assertion.equals !== undefined && count !== Number(assertion.equals)) {
    throw new Error(`State ${stateId} expected ${assertion.selector} count to equal ${assertion.equals}, got ${count}`);
  }
  if (assertion.min !== undefined && count < Number(assertion.min)) {
    throw new Error(`State ${stateId} expected ${assertion.selector} count >= ${assertion.min}, got ${count}`);
  }
  if (assertion.max !== undefined && count > Number(assertion.max)) {
    throw new Error(`State ${stateId} expected ${assertion.selector} count <= ${assertion.max}, got ${count}`);
  }
}

async function assertUrl(page, assertion, stateId) {
  const url = page.url();
  if (assertion.equals !== undefined && url !== String(assertion.equals)) {
    throw new Error(`State ${stateId} expected url to equal ${assertion.equals}, got ${url}`);
  }
  if (assertion.contains !== undefined && !url.includes(String(assertion.contains))) {
    throw new Error(`State ${stateId} expected url to contain ${assertion.contains}, got ${url}`);
  }
}

async function runAssertion(page, assertion, stateId) {
  if (!assertion || typeof assertion !== "object") {
    throw new Error(`State ${stateId} has invalid assertion`);
  }
  const type = assertion.type;
  if (["visible", "hidden", "text", "focused", "css", "count"].includes(type) && !assertion.selector) {
    throw new Error(`State ${stateId} assertion ${type} requires selector`);
  }
  if (type === "visible") {
    await assertVisible(page, assertion, stateId);
  } else if (type === "hidden") {
    await assertHidden(page, assertion, stateId);
  } else if (type === "text") {
    await assertText(page, assertion, stateId);
  } else if (type === "focused") {
    await assertFocused(page, assertion, stateId);
  } else if (type === "css") {
    await assertCss(page, assertion, stateId);
  } else if (type === "count") {
    await assertCount(page, assertion, stateId);
  } else if (type === "url") {
    await assertUrl(page, assertion, stateId);
  } else {
    throw new Error(`State ${stateId} has unsupported assertion type: ${type}`);
  }
}

async function runState(options, state) {
  const { browser, page } = await createBrowserPage(options.width, options.height);
  try {
    await page.goto(targetToUrl(options.target), { waitUntil: "networkidle" });
    for (const action of state.actions) {
      await runAction(page, action, state.id);
    }
    for (const assertion of state.assertions) {
      await runAssertion(page, assertion, state.id);
    }
    return {
      id: state.id,
      ok: true,
      actions: state.actions.length,
      assertions: state.assertions.length,
    };
  } finally {
    await browser.close();
  }
}

async function runInteractionCheck(options) {
  const states = readManifest(options.manifest);
  const results = [];
  for (const state of states) {
    try {
      results.push(await runState(options, state));
    } catch (error) {
      results.push({
        id: state.id,
        ok: false,
        error: error.message,
        actions: state.actions.length,
        assertions: state.assertions.length,
      });
    }
  }
  const failedStates = results.filter((state) => !state.ok);
  const summary = {
    ok: failedStates.length === 0,
    target: options.target,
    manifest: path.resolve(options.manifest),
    width: options.width,
    height: options.height,
    passed: results.length - failedStates.length,
    failed: failedStates.length,
    states: results,
  };
  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(summary, null, 2)}\n`);
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runInteractionCheck({
    target: required(args, "target"),
    manifest: required(args, "manifest"),
    output: args.output || null,
    width: parsePositiveInt(args.width || "1280", "width"),
    height: parsePositiveInt(args.height || "720", "height"),
  });
  if (!summary.ok) {
    const failures = summary.states
      .filter((state) => !state.ok)
      .map((state) => `${state.id}: ${state.error}`)
      .join("\n");
    throw new Error(failures);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = {
  assertCount,
  assertCss,
  assertFocused,
  assertHidden,
  assertText,
  assertUrl,
  assertVisible,
  readManifest,
  runAction,
  runAssertion,
  runInteractionCheck,
  runState,
  selectorCount,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
