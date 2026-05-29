#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { buildSearchSpace, cssPx, normalizeFontFamily } = require("./typography_probe");

assert.equal(cssPx("18px"), 18);
assert.equal(cssPx("normal"), null);
assert.equal(normalizeFontFamily('"Open Sans", sans-serif'), '"Open Sans", Arial, sans-serif');
assert.equal(normalizeFontFamily("Arial, Helvetica, sans-serif"), "Arial, Helvetica, sans-serif");

const base = {
  baseline: {
    fontFamily: "Arial, Helvetica, sans-serif",
    bodyFontSize: "19px",
    bodyFontWeight: "400",
    bodyLineHeight: "1.5",
    mainWidth: "788px",
    h1FontSize: "28px",
    h1LineHeight: "1.15",
    buttonFontSize: "20px",
    untouched: "keep-me",
  },
  parameters: {
    bodyFontSize: ["19px"],
    untouchedParam: ["keep-me"],
  },
};

const typography = {
  roles: {
    body: {
      fontFamily: '"Open Sans", sans-serif',
      fontSize: "18px",
      fontWeight: "500",
      lineHeight: "27px",
    },
    heading: {
      fontSize: "24px",
      fontWeight: "700",
      lineHeight: "36px",
    },
    button: {
      fontSize: "18px",
      fontWeight: "700",
      lineHeight: "25.74px",
    },
  },
};

const searchSpace = buildSearchSpace(typography, base);

assert.equal(searchSpace.baseline.fontFamily, '"Open Sans", Arial, sans-serif');
assert.equal(searchSpace.baseline.bodyFontSize, "18px");
assert.equal(searchSpace.baseline.bodyFontWeight, "500");
assert.equal(searchSpace.baseline.bodyLineHeight, "1.5");
assert.equal(searchSpace.baseline.h1FontSize, "24px");
assert.equal(searchSpace.baseline.h1LineHeight, "1.5");
assert.equal(searchSpace.baseline.buttonFontSize, "18px");
assert.equal(searchSpace.baseline.untouched, "keep-me");
assert.deepEqual(searchSpace.parameters.untouchedParam, ["keep-me"]);
assert.ok(searchSpace.parameters.bodyFontSize.includes("17px"));
assert.ok(searchSpace.parameters.bodyFontSize.includes("19px"));
assert.ok(searchSpace.parameters.bodyFontWeight.includes("600"));
assert.ok(searchSpace.parameters.h1FontSize.includes("24px"));
assert.ok(searchSpace.parameters.buttonFontSize.includes("19px"));

const paragraphFallback = buildSearchSpace({
  roles: {
    body: null,
    paragraph: {
      fontFamily: '"Open Sans", sans-serif',
      fontSize: "18px",
      fontWeight: "500",
      lineHeight: "27px",
    },
  },
}, base);

assert.equal(paragraphFallback.baseline.fontFamily, '"Open Sans", Arial, sans-serif');
assert.equal(paragraphFallback.baseline.bodyFontSize, "18px");
assert.equal(paragraphFallback.baseline.bodyFontWeight, "500");

console.log("typography_probe test passed");
