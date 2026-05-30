const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const skillPath = path.join(root, 'SKILL.md');
const readmePath = path.join(root, 'README.md');
const ledgerTemplatePath = path.join(root, 'templates', 'visual-workflow-ledger.md');

const skill = fs.readFileSync(skillPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const ledgerTemplate = fs.existsSync(ledgerTemplatePath)
  ? fs.readFileSync(ledgerTemplatePath, 'utf8')
  : '';

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
  '### 2. Run A Design-System Census Before Page Lock',
  '### 3. Set The Fidelity Gate And Development Track',
  'Before trusting visual scores, run a scoring harness sanity gate:',
  '#### First-Render Triage',
  '#### Page Focus And Switching Rules',
  'During long-running work, checkpoint after every full scoreboard refresh or every 60-90 minutes',
  'Before OCR, run a text visibility audit',
  'Shared primitive changes need a regression budget:',
  'Artifact ledger path or summary',
  'templates/visual-workflow-ledger.md',
  'pass `--region-manifest`',
  'scripts/visual_region_manifest.js',
  'scripts/visual_ledger_check.js',
  'scripts/visual_interaction_check.js',
  'scripts/visual_artifact_check.js',
  'scripts/visual_readiness_report.js',
  '--max-ui-mismatch',
  'evidence-freshness',
  '--require-ledger',
  '--require-interactions',
  '--require-ocr',
  'missing or invalid',
];

for (const text of requiredSkillSections) {
  assert(skill.includes(text), `SKILL.md missing required workflow guard: ${text}`);
}

const requiredReadmeSections = [
  '## Design-System Census',
  '## Scoring And Triage Gates',
  '## Page-Focused Refinement',
  'Before implementing image-like regions, make an asset decision:',
  'templates/visual-workflow-ledger.md',
  '--region-manifest regions.json',
  '--mask-manifest masks.json',
  'scripts/visual_region_manifest.js',
  'scripts/visual_ledger_check.js',
  'scripts/visual_interaction_check.js',
  'scripts/visual_artifact_check.js',
  'scripts/visual_readiness_report.js',
  'evidence-freshness',
  '--ledger visual-workflow-ledger.md',
  '--manifest interactions.json',
  '--score score.json',
  '--max-ui-mismatch',
  '--require-ledger',
  '--require-interactions',
  '--require-ocr',
  'missing or invalid',
  '--source region-source.json',
  'The JSON summary includes `fullPageMismatch`, `uiMaskedMismatch`, `regionMismatch[]`, `regionGeometry[]`, and `localCropMismatch` when the relevant manifests are supplied.',
];

for (const text of requiredReadmeSections) {
  assert(readme.includes(text), `README.md missing required section: ${text}`);
}

assert(ledgerTemplate, 'templates/visual-workflow-ledger.md must exist');

const requiredTemplateSections = [
  '# Visual Workflow Ledger',
  '## Source Of Truth',
  '## Design-System Census',
  '## Fidelity Gate',
  '## Active Page Lock',
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

console.log('skill_content test passed');
