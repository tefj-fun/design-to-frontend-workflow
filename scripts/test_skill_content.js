const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const skillPath = path.join(root, 'SKILL.md');
const readmePath = path.join(root, 'README.md');
const ledgerTemplatePath = path.join(root, 'templates', 'visual-workflow-ledger.md');
const executionGuidePath = path.join(root, 'references', 'visual-execution-guide.md');

const skill = fs.readFileSync(skillPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const ledgerTemplate = fs.existsSync(ledgerTemplatePath)
  ? fs.readFileSync(ledgerTemplatePath, 'utf8')
  : '';
const executionGuide = fs.existsSync(executionGuidePath)
  ? fs.readFileSync(executionGuidePath, 'utf8')
  : '';

const skillLines = skill.split(/\r?\n/).length;
assert(
  skillLines <= 260,
  `SKILL.md must stay under 260 lines for load efficiency; got ${skillLines}`,
);

const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---/);
assert(frontmatterMatch, 'SKILL.md must start with YAML frontmatter');

const descriptionMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
assert(descriptionMatch, 'frontmatter must include a description');

const description = descriptionMatch[1].trim();
assert(description.startsWith('Use when '), 'description must describe trigger conditions');
assert(
  description.length <= 500,
  `description must stay under 500 characters; got ${description.length}`,
);

const forbiddenWorkflowSummary = [
  /Guides Codex/i,
  /workflow using/i,
  /component extraction/i,
  /local rendering/i,
  /screenshot comparison/i,
  /interaction validation/i,
];

for (const pattern of forbiddenWorkflowSummary) {
  assert(
    !pattern.test(description),
    `description should not summarize workflow details: ${pattern}`,
  );
}

const requiredSkillSections = [
  'Run preflight before long-running visual loops',
  '### 2. Run A Design-System Census Before Page Lock',
  '### 3. Set The Fidelity Gate And Development Track',
  'Development readiness is separate from visual readiness',
  'Before trusting visual scores, run a scoring harness sanity gate:',
  'Stop low-level visual tuning after three measured probes fail to improve the active gate',
  '#### First-Render Triage',
  '#### Page Focus And Switching Rules',
  'During long-running work, checkpoint after every full scoreboard refresh or every 60-90 minutes',
  'fast subagent patch pass',
  'parent/controller reviews the diff and reruns full-page plus local-region comparison',
  'Before OCR, run a text visibility audit',
  'references/visual-execution-guide.md',
  'Shared primitive changes need a regression budget:',
  'Artifact ledger path or summary',
  'templates/visual-workflow-ledger.md',
  'scripts/visual_preflight_check.js',
  'pass `--region-manifest`',
  'scripts/visual_region_manifest.js',
  'scripts/visual_ledger_check.js',
  'scripts/visual_interaction_check.js',
  'scripts/visual_artifact_check.js',
  'scripts/visual_readiness_report.js',
  'scripts/visual_workflow_fixture_check.js',
  'scripts/visual_text_visibility_check.js',
  '--manifest text-visibility.json',
  '--text-visibility-summary',
  '--max-ui-mismatch',
  'evidence-freshness',
  '--require-ledger',
  '--require-interactions',
  '--require-text-visibility',
  '--require-ocr',
  'missing or invalid',
];

for (const text of requiredSkillSections) {
  assert(skill.includes(text), `SKILL.md missing required workflow guard: ${text}`);
}

const requiredReadmeSections = [
  '## Preflight',
  '## Design-System Census',
  '## Development Readiness',
  '## Stop Budget',
  '## Scoring And Triage Gates',
  '## Page-Focused Refinement',
  'references/visual-execution-guide.md',
  'scripts/visual_preflight_check.js',
  'Before implementing image-like regions, make an asset decision:',
  'templates/visual-workflow-ledger.md',
  '--region-manifest regions.json',
  '--mask-manifest masks.json',
  'scripts/visual_region_manifest.js',
  'scripts/visual_ledger_check.js',
  'scripts/visual_interaction_check.js',
  'scripts/visual_artifact_check.js',
  'scripts/visual_readiness_report.js',
  'scripts/visual_workflow_fixture_check.js',
  'scripts/visual_text_visibility_check.js',
  '--manifest text-visibility.json',
  '--text-visibility-summary',
  'evidence-freshness',
  '--ledger visual-workflow-ledger.md',
  '--manifest interactions.json',
  '--score score.json',
  '--max-ui-mismatch',
  '--require-ledger',
  '--require-interactions',
  '--require-text-visibility',
  '--require-ocr',
  'missing or invalid',
  '--source region-source.json',
  'The JSON summary includes `fullPageMismatch`, `uiMaskedMismatch`, `regionMismatch[]`, `regionGeometry[]`, and `localCropMismatch` when the relevant manifests are supplied.',
];

for (const text of requiredReadmeSections) {
  assert(readme.includes(text), `README.md missing required section: ${text}`);
}

assert(ledgerTemplate, 'templates/visual-workflow-ledger.md must exist');
assert(executionGuide, 'references/visual-execution-guide.md must exist');

const requiredTemplateSections = [
  '# Visual Workflow Ledger',
  '## Source Of Truth',
  '## Preflight',
  '## Design-System Census',
  '## Fidelity Gate',
  '## Development Readiness',
  '## Active Page Lock',
  '## Stop Budget',
  '## Scoring Harness Sanity',
  '## First-Render Triage',
  '## Asset Decisions',
  '## Text Visibility And OCR',
  '## Shared Primitive Regression Budget',
  '## Artifact Ledger',
  '## Checkpoints',
  '## Final Verification',
];

for (const text of requiredTemplateSections) {
  assert(
    ledgerTemplate.includes(text),
    `visual-workflow-ledger template missing section: ${text}`,
  );
}

const requiredExecutionGuideSections = [
  'Run preflight before long-running visual loops',
  'scripts/visual_preflight_check.js',
  'component-region manifest',
  'mask manifest',
  'icon manifest',
  'Development readiness is separate from visual readiness',
  'Stop low-level visual tuning after three measured probes fail to improve the active gate',
  'fast subagent patch pass',
  'First-Render Triage',
  'Page Focus',
  'visual_text_visibility_check.js',
  'visual_ocr_compare.js',
  'visual_local_search.js',
  'visual_readiness_report.js',
  'scripts/visual_workflow_fixture_check.js',
  'Benchmark Validation',
  'Output Report',
];

for (const text of requiredExecutionGuideSections) {
  assert(
    executionGuide.includes(text),
    `visual execution guide missing section: ${text}`,
  );
}

console.log('skill_content test passed');
