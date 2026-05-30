const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visual-preflight-test-"));
const script = path.resolve(__dirname, "visual_preflight_check.js");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writePng(file, width, height) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255;
    png.data[i + 1] = 255;
    png.data[i + 2] = 255;
    png.data[i + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

const baseSummary = path.join(tmp, "base-summary.json");
const base = run(["--output", baseSummary]);
assert.equal(base.status, 0, base.stderr || base.stdout);
const baseJson = readJson(baseSummary);
assert.equal(baseJson.ok, true);
for (const name of ["node", "playwright-package", "pngjs-package"]) {
  assert.equal(
    baseJson.checks.some((check) => check.name === name && check.ok === true),
    true,
    `expected passing check ${name}`,
  );
}

const reference = path.join(tmp, "reference.png");
const candidate = path.join(tmp, "candidate.png");
const imageSummary = path.join(tmp, "image-summary.json");
writePng(reference, 24, 16);
writePng(candidate, 24, 16);
const imageRun = run([
  "--reference",
  reference,
  "--candidate",
  candidate,
  "--output",
  imageSummary,
]);
assert.equal(imageRun.status, 0, imageRun.stderr || imageRun.stdout);
const imageJson = readJson(imageSummary);
const dimensionCheck = imageJson.checks.find((check) => check.name === "image-dimensions");
assert.equal(dimensionCheck.ok, true);
assert.deepEqual(dimensionCheck.details.reference, { width: 24, height: 16 });
assert.deepEqual(dimensionCheck.details.candidate, { width: 24, height: 16 });

const ocrSummary = path.join(tmp, "ocr-summary.json");
const ocrRun = run([
  "--require-tesseract",
  "--tesseract-bin",
  "definitely-not-installed-tesseract",
  "--output",
  ocrSummary,
]);
assert.notEqual(ocrRun.status, 0, "required missing tesseract should fail");
const ocrJson = readJson(ocrSummary);
const tesseractCheck = ocrJson.checks.find((check) => check.name === "tesseract");
assert.equal(tesseractCheck.ok, false);
assert.match(tesseractCheck.message, /not available/i);

console.log("visual_preflight_check test passed");
