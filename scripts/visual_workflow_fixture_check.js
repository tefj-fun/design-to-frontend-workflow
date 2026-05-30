#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parseArgs } = require("./visual_compare");

const WIDTH = 640;
const HEIGHT = 360;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`);
}

function runNode(scriptName, args) {
  const script = path.resolve(__dirname, scriptName);
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed:\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function writeHtml(filePath) {
  fs.writeFileSync(filePath, `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Workflow Fixture</title>
    <style>
      :root { --bg: #f7f9fc; --panel: #ffffff; --text: #111827; --muted: #5b6472; --blue: #2563eb; }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; }
      .shell { display: grid; grid-template-columns: 144px 1fr; min-height: 100vh; }
      .nav { background: #0f172a; color: white; padding: 24px 18px; }
      .brand { font-weight: 700; font-size: 20px; margin-bottom: 24px; }
      .nav-item { color: #dbeafe; font-size: 14px; margin: 14px 0; }
      .main { padding: 24px 28px; }
      .eyebrow { color: var(--muted); font-size: 13px; margin: 0 0 4px; }
      h1 { font-size: 28px; line-height: 34px; margin: 0 0 18px; }
      .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
      .search { width: 210px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; color: #334155; background: white; }
      .button { border: 0; border-radius: 6px; background: var(--blue); color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .card { background: var(--panel); border: 1px solid #d7dee8; border-radius: 8px; padding: 18px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); }
      .card-title { display: flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 8px; }
      .icon { width: 18px; height: 18px; display: inline-grid; place-items: center; border-radius: 50%; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; }
      .metric { font-size: 32px; line-height: 36px; font-weight: 700; margin: 0; }
      .muted { color: var(--muted); font-size: 13px; margin: 6px 0 0; }
      .modal { display: none; position: absolute; left: 254px; top: 132px; width: 240px; padding: 18px; border: 1px solid #94a3b8; border-radius: 8px; background: white; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22); }
      .modal[data-open="true"] { display: block; }
      .modal-title { font-weight: 700; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="nav">
        <div class="brand">Northstar</div>
        <div class="nav-item">Dashboard</div>
        <div class="nav-item">Reports</div>
      </aside>
      <main class="main">
        <p class="eyebrow">Verified workflow fixture</p>
        <h1>Operations Dashboard</h1>
        <div class="toolbar">
          <div class="search">Search facilities</div>
          <button id="open-report" class="button">Create report</button>
        </div>
        <section class="grid">
          <article id="uptime-card" class="card">
            <div class="card-title"><span class="icon" aria-hidden="true">U</span><span>System uptime</span></div>
            <p class="metric">99.8%</p>
            <p class="muted">Across monitored sites</p>
          </article>
          <article id="alerts-card" class="card">
            <div class="card-title"><span class="icon" aria-hidden="true">A</span><span>Open alerts</span></div>
            <p class="metric">12</p>
            <p class="muted">Four require review</p>
          </article>
        </section>
      </main>
    </div>
    <div id="report-modal" class="modal" role="dialog" aria-modal="true">
      <div class="modal-title">Report ready</div>
      <div class="muted">Workflow evidence package generated.</div>
    </div>
    <script>
      document.getElementById("open-report").addEventListener("click", () => {
        document.getElementById("report-modal").dataset.open = "true";
      });
    </script>
  </body>
</html>`);
}

function writeFixtureFiles(workDir) {
  const paths = {
    referenceHtml: path.join(workDir, "reference.html"),
    candidateHtml: path.join(workDir, "candidate.html"),
    referencePng: path.join(workDir, "reference.png"),
    candidatePng: path.join(workDir, "candidate.png"),
    diffPng: path.join(workDir, "diff.png"),
    referenceSelfDiff: path.join(workDir, "reference-self-diff.png"),
    score: path.join(workDir, "score.json"),
    regions: path.join(workDir, "regions.json"),
    regionSource: path.join(workDir, "region-source.json"),
    textManifest: path.join(workDir, "text-visibility.json"),
    textSummary: path.join(workDir, "text-visibility-summary.json"),
    ocrSummary: path.join(workDir, "ocr-summary.json"),
    interactions: path.join(workDir, "interactions.json"),
    interactionSummary: path.join(workDir, "interaction-summary.json"),
    ledger: path.join(workDir, "visual-workflow-ledger.md"),
    readinessSummary: path.join(workDir, "readiness-summary.json"),
  };

  writeHtml(paths.referenceHtml);
  writeHtml(paths.candidateHtml);
  writeJson(paths.regionSource, {
    regions: [
      { id: "primary-cta", selector: "#open-report", role: "button", state: "default", padding: 4 },
      { id: "uptime-card", selector: "#uptime-card", role: "card", padding: 4 },
    ],
  });
  writeJson(paths.textManifest, {
    texts: [
      { id: "page-title", selector: "h1", text: "Operations Dashboard", minContrast: 4.5, expectedLineCount: 1 },
      { id: "primary-cta", selector: "#open-report", text: "Create report", minContrast: 3, expectedLineCount: 1 },
      { id: "uptime-label", selector: "#uptime-card .card-title", text: "System uptime", minContrast: 4.5 },
    ],
  });
  writeJson(paths.interactions, {
    states: [
      {
        id: "open-report-modal",
        actions: [{ type: "click", selector: "#open-report" }],
        assertions: [
          { type: "visible", selector: "#report-modal" },
          { type: "text", selector: "#report-modal", contains: "Report ready" },
        ],
      },
    ],
  });
  fs.writeFileSync(paths.ledger, [
    "# Visual Workflow Ledger",
    "",
    "## Source Of Truth",
    "",
    "- Primary reference: reference.html",
    "- Secondary references: none",
    "- Structured source available: yes",
    "- Screenshot-only uncertainties: none",
    "- Viewports and states in scope: 640x360 default and modal state",
    "- Explicit exclusions: none",
    "",
    "## Design-System Census",
    "",
    "- Shared shell/layout: sidebar plus main dashboard content",
    "- Tokens: blue primary action, slate nav, white cards, 8px radius",
    "- Shared components: button, card, metric label, modal",
    "- Shared icon language: small circular letter icons",
    "- Page templates: dashboard",
    "- Asset/raster policy: no raster assets",
    "- Exceptions that should stay separate: modal overlay",
    "- Deferred primitives: none",
    "",
    "## Fidelity Gate",
    "",
    "- Active gate: benchmark",
    "- Target score or non-score acceptance rule: uiMaskedMismatch <= 1",
    "- Backend/API/data work allowed in parallel: yes",
    "- Hard blockers to visual work: none",
    "",
    "## Active Page Lock",
    "",
    "- Active page/route/state: Dashboard default",
    "- Why this page is active: representative validation fixture",
    "- Entry score: 0",
    "- Current score: 0",
    "- Best-known score: 0",
    "- Exit condition: readiness report passes",
    "- Switch reason, if changing pages:",
    "",
    "## Scoring Harness Sanity",
    "",
    "- Viewport, height, DPR, color scheme, locale, and route/state match: yes",
    "- Screenshot dimensions match: yes",
    "- Fonts/assets loaded: yes",
    "- Fresh reference/current/diff/score artifacts: yes",
    "- Mask boxes checked: no masks",
    "- Score invariant `0 <= uiMaskedMismatch <= fullPageMismatch <= 100`: yes",
    "- Console/network issues: none",
    "",
    "## First-Render Triage",
    "",
    "- Dominant class: polish-noise",
    "- Evidence: fixture candidate intentionally matches reference",
    "- Strategy chosen: final verification",
    "- Reclassification history: none",
    "",
    "## Asset Decisions",
    "",
    "| Region | Policy | Evidence | Follow-up |",
    "| --- | --- | --- | --- |",
    "| none | representative-accepted | no raster regions | none |",
    "",
    "## Text Visibility And OCR",
    "",
    "- DOM text existence checked: yes",
    "- Client rects and line boxes checked: yes",
    "- Overflow clipping checked: yes",
    "- Overlap / elementFromPoint checked: yes",
    "- Contrast checked: yes",
    "- OCR run and result: expected to pass",
    "",
    "## Shared Primitive Regression Budget",
    "",
    "| Primitive | Affected pages | Baseline evidence | Result | Accepted? |",
    "| --- | --- | --- | --- | --- |",
    "| card/button/modal | dashboard | fixture baseline | no regression | yes |",
    "",
    "## Artifact Ledger",
    "",
    "| Artifact | Path |",
    "| --- | --- |",
    `| Reference screenshot | ${paths.referencePng} |`,
    `| Current screenshot | ${paths.candidatePng} |`,
    `| Diff image | ${paths.diffPng} |`,
    `| Score JSON | ${paths.score} |`,
    "| Mask manifest | none |",
    `| Component-region manifest | ${paths.regions} |`,
    `| OCR/text diagnostics | ${paths.ocrSummary} |`,
    "| Structured reference diagnostics | none |",
    "",
    "## Patch Ledger",
    "",
    "| Patch | Type | Evidence | Outcome |",
    "| --- | --- | --- | --- |",
    "| fixture validation | visual | full evidence chain | accepted |",
    "",
    "## Checkpoints",
    "",
    "| Time | Active page | Current/best score | Accepted changes | Rejected hypotheses | Blocker class | Next patch | Gate feasible? |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| 12:00 | Dashboard | 0/0 | fixture evidence | none | polish-noise | final verify | yes |",
    "",
    "## Final Verification",
    "",
    "- Active fidelity gate met or blocker documented: yes",
    "- Full-page and masked scores verified: yes",
    "- Local component regions verified: yes",
    "- Text/OCR diagnostics verified where needed: yes",
    "- Interaction states checked: yes",
    "- Responsive breakpoints checked: default fixture viewport",
    "- Shared primitive regressions checked: yes",
    "- Known tradeoffs: none",
    "- Next step: none",
    "",
  ].join("\n"));

  return paths;
}

function buildWorkflowSummary(workDir, paths, summaries) {
  const requiredArtifacts = {
    referenceHtml: paths.referenceHtml,
    candidateHtml: paths.candidateHtml,
    referencePng: paths.referencePng,
    candidatePng: paths.candidatePng,
    diffPng: paths.diffPng,
    score: paths.score,
    regions: paths.regions,
    textManifest: paths.textManifest,
    textSummary: paths.textSummary,
    ocrSummary: paths.ocrSummary,
    interactions: paths.interactions,
    interactionSummary: paths.interactionSummary,
    ledger: paths.ledger,
    readinessSummary: paths.readinessSummary,
  };
  const evidence = {
    sourceOfTruth: {
      ok: fs.existsSync(paths.referenceHtml) && fs.existsSync(paths.candidateHtml),
      primary: "reference.html",
      kind: "structured-html-fixture",
    },
    designSystemCensus: {
      ok: fs.readFileSync(paths.ledger, "utf8").includes("## Design-System Census"),
      ledger: paths.ledger,
    },
    renderCapture: {
      ok: fs.existsSync(paths.referencePng) && fs.existsSync(paths.candidatePng) && fs.existsSync(paths.diffPng),
      reference: paths.referencePng,
      candidate: paths.candidatePng,
      diff: paths.diffPng,
    },
    visualCompare: {
      ok: summaries.score.sanity.dimensionsMatch === true && summaries.score.sanity.scoreInvariantOk === true,
      summary: summaries.score,
    },
    textVisibility: {
      ok: summaries.textVisibility.ok === true,
      summary: summaries.textVisibility,
    },
    ocr: {
      ok: summaries.ocr.ok === true,
      summary: summaries.ocr,
    },
    interactions: {
      ok: summaries.interactions.ok === true,
      summary: summaries.interactions,
    },
    readiness: {
      ok: summaries.readiness.ok === true,
      checks: summaries.readiness.checks,
      summary: summaries.readiness,
    },
  };
  const ok = Object.values(evidence).every((item) => item.ok)
    && Object.values(requiredArtifacts).every((artifactPath) => fs.existsSync(artifactPath));
  return {
    ok,
    workDir,
    viewport: { width: WIDTH, height: HEIGHT },
    evidence,
    artifacts: requiredArtifacts,
  };
}

function runWorkflowFixture(options) {
  const workDir = path.resolve(options.workDir || fs.mkdtempSync(path.join(os.tmpdir(), "visual-workflow-fixture-")));
  fs.mkdirSync(workDir, { recursive: true });
  const paths = writeFixtureFiles(workDir);

  fs.writeFileSync(paths.referencePng, "");
  runNode("visual_compare.js", [
    "--reference", paths.referencePng,
    "--target", paths.referenceHtml,
    "--rendered", paths.referencePng,
    "--diff", paths.referenceSelfDiff,
    "--width", String(WIDTH),
    "--height", String(HEIGHT),
  ]);

  runNode("visual_region_manifest.js", [
    "--target", paths.candidateHtml,
    "--source", paths.regionSource,
    "--output", paths.regions,
    "--width", String(WIDTH),
    "--height", String(HEIGHT),
  ]);

  const score = runNode("visual_compare.js", [
    "--reference", paths.referencePng,
    "--target", paths.candidateHtml,
    "--rendered", paths.candidatePng,
    "--diff", paths.diffPng,
    "--width", String(WIDTH),
    "--height", String(HEIGHT),
    "--region-manifest", paths.regions,
  ]);
  writeJson(paths.score, score);

  const textVisibility = runNode("visual_text_visibility_check.js", [
    "--target", paths.candidateHtml,
    "--manifest", paths.textManifest,
    "--output", paths.textSummary,
    "--width", String(WIDTH),
    "--height", String(HEIGHT),
  ]);

  const ocr = runNode("visual_ocr_compare.js", [
    "--reference", paths.referencePng,
    "--candidate", paths.candidatePng,
  ]);
  writeJson(paths.ocrSummary, ocr);

  const interactions = runNode("visual_interaction_check.js", [
    "--target", paths.candidateHtml,
    "--manifest", paths.interactions,
    "--output", paths.interactionSummary,
    "--width", String(WIDTH),
    "--height", String(HEIGHT),
  ]);

  const readiness = runNode("visual_readiness_report.js", [
    "--score", paths.score,
    "--newer-than", paths.candidateHtml,
    "--ledger", paths.ledger,
    "--interaction-summary", paths.interactionSummary,
    "--text-visibility-summary", paths.textSummary,
    "--ocr-summary", paths.ocrSummary,
    "--max-ui-mismatch", "1",
    "--require-ledger",
    "--require-interactions",
    "--require-text-visibility",
    "--require-ocr",
    "--require-regions",
    "--output", paths.readinessSummary,
  ]);

  const summary = buildWorkflowSummary(workDir, paths, {
    score,
    textVisibility,
    ocr,
    interactions,
    readiness,
  });
  if (options.output) {
    writeJson(options.output, summary);
  }
  return summary;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = runWorkflowFixture({
    output: args.output || null,
    workDir: args["work-dir"] || null,
  });
  const output = `${JSON.stringify(summary, null, 2)}\n`;
  if (!summary.ok) {
    process.stderr.write(output);
    process.exit(1);
  }
  process.stdout.write(output);
}

module.exports = {
  buildWorkflowSummary,
  runWorkflowFixture,
  writeFixtureFiles,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
