# Progressive Disclosure Entrypoint Design

## Purpose

`SKILL.md` has become operationally strong but too large for the goal of efficient skill loading. The entrypoint should give agents the critical workflow, required evidence, acceptance gates, and anti-patterns without carrying every detailed procedure inline. Detailed guidance should live in references that are loaded only when needed.

## Chosen Approach

Refactor `SKILL.md` into a concise control-plane entrypoint and add `references/visual-execution-guide.md` for detailed execution procedure.

`SKILL.md` must keep:

- trigger-focused frontmatter
- source-of-truth ranking
- design-system census requirement
- staged fidelity gates
- component-first implementation rule
- render/capture/compare loop
- text visibility before OCR
- interaction validation
- final readiness report command and required evidence
- acceptance criteria
- anti-patterns
- explicit progressive-disclosure links

`references/visual-execution-guide.md` should hold expanded details for:

- component-region, mask, asset, and icon manifests
- design-system census details
- scoring sanity, local region diagnostics, and OCR/text diagnostics
- first-render triage and page focus
- local search and subagent patch review
- benchmark validation and output reporting

## Constraints

- Keep `SKILL.md` under 260 lines.
- Preserve all existing scripts and command names.
- Keep paper methodology references separate from execution details.
- Do not weaken final readiness evidence requirements.
- Content tests should verify both entrypoint brevity and required progressive-disclosure references.

## Testing

Update `scripts/test_skill_content.js` to fail when:

- `SKILL.md` exceeds 260 lines
- the detailed reference file is missing
- the entrypoint does not point to `references/visual-execution-guide.md`
- the detailed reference does not include local-region, mask, icon, OCR/text, page-focus, local-search, benchmark, and output-report guidance

## Documentation

Update README’s included-files list so the new execution guide is discoverable.
