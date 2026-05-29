# Paper Workflow Map

Use this reference when the user asks for research justification, methodology, citations, or how design-to-code papers combine into a practical frontend workflow.

For equation-level extraction, objectives, rewards, and metrics, read `paper-methodology-notes.md`.

## Evidence Grades

- **Strong**: directly supported by the paper's stated task, method, or evaluation.
- **Adapted**: the paper supports the principle, but Codex applies it manually with local tools rather than using the paper's model/training pipeline.
- **Caution**: the paper explicitly shows a limitation or risk.

## Paper Roles

| Paper | Evidence | Use It For | Practical Lesson |
| --- | --- | --- | --- |
| Figma2Code: Automating Multimodal Design to Code in the Wild | Strong + Caution | Structured Figma handoff | Use metadata, assets, and screenshots together, but convert primitive/absolute metadata into maintainable responsive code. |
| Design2Code: Benchmarking Multimodal Code Generation for Automated Front-End Engineering | Strong | Screenshot-to-code benchmark and visual evaluation | Generate executable code, render it, and compare rendered screenshots against references using content, position, color, and overall visual criteria. |
| VisRefiner: Learning from Visual Differences for Screenshot-to-Code Generation | Adapted | Difference-driven refinement | Codex should imitate the render, compare, revise loop; do not claim to use VisRefiner training unless that model/training is actually used. |
| UI2Code^N: UI-to-Code Generation as Interactive Visual Optimization | Adapted + Caution | Iterative test-time polishing | Multiple refinement rounds can improve output, but reward/evaluator quality matters and CLIP-only reward can mislead. |
| WebVIA: A Web-based Vision-Language Agentic Framework for Interactive and Verifiable UI-to-Code Generation | Adapted | Interactive UI validation | For apps, capture and validate multiple UI states, not only a static screenshot. |

## What Each Paper Actually Supports

### Figma2Code

**Method signal:** The task input is multimodal: Figma JSON metadata, associated assets, and a rendered design screenshot. The paper collects Figma Community designs, filters/deduplicates them, refines metadata, integrates assets, and evaluates visual fidelity plus code quality dimensions such as responsiveness and maintainability.

**Use in this skill:** Prefer Figma/source-design handoff over a flat PNG when available. Extract hierarchy, styles, image assets, SVG assets, and components before coding.

**Caution:** Figma metadata can encourage models to map absolute coordinates and primitive visual attributes directly. For real frontend work, convert metadata into responsive layout primitives and reusable components.

### Design2Code

**Method signal:** The benchmark gives models a webpage screenshot and asks for a standalone HTML/CSS implementation. Generated code is rendered, then compared with the reference using high-level visual similarity and low-level element metrics: block match, text, position, and color. It also tests direct prompting, text-augmented prompting, and self-revision prompting.

**Use in this skill:** Render the implementation before judging it. Compare the reference and generated UI on content, layout, text, position, and color. If text is known, provide it explicitly instead of relying on OCR from the image.

**Caution:** Design2Code targets standalone HTML/CSS for benchmarking. For production apps, adapt the evaluation idea to the repo's stack rather than copying the single-file output shape.

### VisRefiner

**Method signal:** The paper trains models using visual difference-aligned examples and reinforcement learning for self-refinement. It treats `(rendered output, target screenshot, current code) -> improved code` as the refinement task.

**Use in this skill:** Manually implement the same operational loop: render current UI, compare against target, describe concrete visual discrepancies, patch code, and rerender.

**Caution:** This is not evidence that a generic prompt alone performs VisRefiner's learned refinement. The skill should frame this as an adapted engineering workflow.

### UI2Code^N

**Method signal:** The paper defines interactive UI-to-code as generation, polishing, and editing with visual feedback. It reports test-time improvement from repeated polishing rounds and warns that reward design is central; VLM-based comparison can outperform CLIP-only reward.

**Use in this skill:** Run multiple targeted refinement rounds when fidelity matters. Prefer human-readable visual difference notes or VLM/browser-aided comparison over a single scalar image similarity score.

**Caution:** Do not over-optimize for a brittle visual metric. A closer screenshot can still contain poor code, broken responsiveness, or missing interactions.

### WebVIA

**Method signal:** The framework has an exploration agent to capture multi-state UI screenshots, a UI2Code model to generate executable interactive code, and a validation module to verify interactions. It evaluates generated pages with interaction tasks, not only visual layout.

**Use in this skill:** For real apps, define interaction states and validate them after static visual matching: filters, forms, dropdowns, navigation, maps, modals, hover/focus, loading, empty, and error states.

**Caution:** WebVIA's explored actions are narrower than all possible UI interactions. Do not assume drag/draw/complex gestures are covered unless explicitly tested.

## Robust Combined Workflow

```text
source design
-> source strength assessment
-> structured handoff: hierarchy + text + tokens + assets + states
-> component-first implementation in the app stack
-> local render
-> screenshot capture at target breakpoints
-> visual discrepancy list
-> targeted code patches
-> rerender and repeat
-> interaction-state validation
-> final report with evidence and known gaps
```

## Decision Rules

1. **If Figma is available:** Use Figma metadata/assets to build a component map, then translate to responsive components. Do not mirror absolute positions blindly.
2. **If only a screenshot is available:** Extract text and assets first, document inferred parts, then implement a first pass.
3. **If the UI is an app workflow:** Add WebVIA-style state coverage before claiming completion.
4. **If visual fidelity is disputed:** Capture fresh screenshots and list concrete deltas before patching.
5. **If the code looks visually close but is brittle:** Favor maintainability and responsiveness over pixel copying.

## Recommended Default For React/Next.js

1. Extract a source-of-truth design brief.
2. Create a component map aligned to the repo's design system.
3. Convert visual tokens into theme variables or local styles.
4. Implement component-first in React/Next.js.
5. Run the app locally.
6. Capture screenshots at `1440`, `768`, and `390`.
7. Compare against reference mockups and record deltas.
8. Patch the largest content/layout/responsiveness issues.
9. Validate interactive states.
10. Report evidence level, screenshots checked, remaining mismatches, and next refinement.

## Citation Links

- Figma2Code: `https://arxiv.org/abs/2604.13648`
- Design2Code: `https://arxiv.org/abs/2403.03163`
- VisRefiner: `https://arxiv.org/abs/2602.05998`
- UI2Code^N: `https://arxiv.org/abs/2511.08195`
- WebVIA: `https://arxiv.org/abs/2511.06251`
