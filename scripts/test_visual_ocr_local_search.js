#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  canConsiderCandidate,
  compareCandidateScores,
} = require("./visual_ocr_local_search");

function candidate(name, mismatchedPixels, ocr) {
  return {
    name,
    mismatchedPixels,
    mismatchPercent: mismatchedPixels / 1000,
    ocr,
  };
}

const pixelBestButOcrBroken = candidate("pixel-best", 17000, {
  missingReferenceLines: 1,
  missingCandidateLines: 0,
  maxAbsTopDelta: 21,
  averageAbsTopDelta: 7.5,
  averageAbsWidthDelta: 22,
});

const pixelWorseButOcrCorrect = candidate("ocr-correct", 19000, {
  missingReferenceLines: 0,
  missingCandidateLines: 0,
  maxAbsTopDelta: 6,
  averageAbsTopDelta: 2.2,
  averageAbsWidthDelta: 8,
});

const sameOcrPixelBetter = candidate("same-ocr-pixel-better", 16000, {
  missingReferenceLines: 0,
  missingCandidateLines: 0,
  maxAbsTopDelta: 6,
  averageAbsTopDelta: 2.2,
  averageAbsWidthDelta: 8,
});

assert.equal(compareCandidateScores(pixelWorseButOcrCorrect, pixelBestButOcrBroken), -1);
assert.equal(compareCandidateScores(pixelBestButOcrBroken, pixelWorseButOcrCorrect), 1);
assert.equal(compareCandidateScores(sameOcrPixelBetter, pixelWorseButOcrCorrect), -1);
assert.equal(canConsiderCandidate(pixelWorseButOcrCorrect, pixelBestButOcrBroken, 18), true);
assert.equal(canConsiderCandidate(candidate("over-cap-same-ocr", 19000, pixelBestButOcrBroken.ocr), pixelBestButOcrBroken, 18), false);

console.log("visual_ocr_local_search ranking tests passed");
