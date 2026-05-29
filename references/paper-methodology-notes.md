# Paper Methodology Notes

Use this reference when the user asks whether the design-to-frontend workflow is actually grounded in paper methods, objectives, equations, rewards, or evaluation metrics. It separates direct paper methodology from practical adaptation for Codex.

## Quick Evidence Boundary

| Paper | Directly Extracted Methodology | Equations / Objectives Present | Codex Workflow Adaptation |
| --- | --- | --- | --- |
| Design2Code | Screenshot-to-HTML benchmark, prompting modes, render-based visual evaluation | Block-match, text similarity, position similarity, CLIP similarity, CIEDE2000 color comparison | Use render-and-compare evaluation against a reference mockup. |
| Figma2Code | Multimodal Figma metadata/assets/screenshot task, dataset construction, F2CAgent baseline, fidelity/responsiveness/maintainability metrics | Joint objective over visual dissimilarity, responsiveness score, maintainability score | Prefer structured design handoff but translate metadata into responsive components. |
| VisRefiner | Difference-aligned supervision plus GRPO self-refinement from rendered visual differences | Refinement task, SFT loss, RIS, composite reward, GRPO advantage/loss | Manually imitate render, compare, patch, rerender; do not claim to use learned VisRefiner. |
| UI2Code^N | Interactive visual optimization with drafting, polishing, editing, RVPO, VLM-based rewards | Visual optimization objective, polishing transition, pairwise preference, tournament reward, GRPO, SFT losses | Use iterative visual refinement and relative comparison instead of single-pass generation. |
| WebVIA | Multi-state interaction graph discovery, interactive code generation, validation over tasks | State/action graph formalism, cross-entropy SFT, weighted exploration score | Validate real UI states and workflows, not just the static screen. |

## Design2Code

**Methodology extracted**

- Builds a real-world benchmark of 484 webpages after automated filtering and manual curation.
- Converts each webpage into a screenshot-to-code task: input is a reference webpage screenshot; output is standalone HTML/CSS that renders like the screenshot.
- Tests three prompting modes:
  - Direct prompting: screenshot plus instruction to generate HTML/CSS.
  - Text-augmented prompting: screenshot plus extracted page text.
  - Self-revision: reference screenshot, generated screenshot, and generated code are given back to the model for revision.
- Evaluates by rendering generated HTML and comparing the generated screenshot to the reference screenshot.

**Key metrics and equations**

- High-level visual similarity:
  - `CLIP(I_R, I_G)` between reference screenshot `I_R` and generated screenshot `I_G`, with text boxes masked/inpainted before CLIP feature extraction.
- Element sets:
  - Detect visual/text blocks in both screenshots: `R = {r_1, ..., r_m}` and `G = {g_1, ..., g_n}`.
  - Use optimal matching `M` between detected blocks, based on text similarity.
- Block-match contribution for matched pair `(r_p, g_q)`:
  - `match_block(r_p, g_q) = (S(r_p) + S(g_q)) / (sum_matched_sizes + sum_unmatched_reference_sizes + sum_unmatched_generated_sizes)`.
- Aggregate block match:
  - `match_block(R, G) = sum_{(p,q) in M} match_block(r_p, g_q)`.
- Text similarity:
  - Character-level Sørensen-Dice similarity: `2 * overlap_chars / (chars_ref + chars_gen)`.
- Position similarity:
  - `sim_pos(r_p, g_q) = 1 - max(|x_q - x_p|, |y_q - y_p|)`, using normalized block centers.
- Color similarity:
  - Uses CIEDE2000 color difference for perceptual text-color comparison.

**What this means for Codex**

Use Design2Code as the baseline evidence for `reference screenshot -> generated code -> rendered screenshot -> visual/element comparison`. Text-augmented prompting supports extracting text from the design before asking the model to generate code. Self-revision supports a render-and-revise loop, but the paper found self-revision was not uniformly helpful, so Codex should verify rather than assume refinement improves output.

## Figma2Code

**Methodology extracted**

- Formulates a multimodal Figma-to-code task using:
  - `M`: JSON metadata with hierarchy/properties.
  - `A`: design assets such as icons and images.
  - `V`: rendered screenshot of the Figma design.
- Dataset is built from Figma Community files through crawling, Figma API retrieval, filtering, annotation, metadata refinement, asset extraction, deduplication, and partitioning.
- Evaluates image-only, metadata-only, and multimodal image+metadata generation.
- Includes `F2CAGENT`, which converts raw Figma JSON into an intermediate representation, generates code with templates, then uses a critic/refiner loop.

**Objective**

Input: `I = (M, A, V)`.

Output: codebase `C`; rendered output is `Render(C)`.

Joint objective:

```text
C_hat = argmax_C [ -alpha * D(V, Render(C)) + beta * RS(C) + gamma * MS(C) ]
```

Where:

- `D(V, Render(C))`: perceptual dissimilarity between design screenshot and rendered code.
- `RS(C)`: layout responsiveness score.
- `MS(C)`: code maintainability score.
- `alpha, beta, gamma >= 0`: tradeoff weights.

**Evaluation metrics**

- Visual fidelity:
  - `VES = cos(Encode(rendered_page), Encode(design_image))`; the paper uses DINOv2 embeddings.
  - Normalized MAE between rendered screenshot and design image.
- Responsiveness:
  - `RUR`: relative unit ratio, such as `%`, `em`, `rem`, `vw/vh`, `fr`.
  - `APR`: absolute/fixed positioning ratio.
- Maintainability:
  - `STR`: semantic tag ratio.
  - `AVU`: arbitrary value usage, such as Tailwind arbitrary classes.

**Key caveat**

Metadata improves visual fidelity but can make code rigid. The paper reports metadata-heavy methods can increase absolute positioning and arbitrary values. For Codex, this means Figma metadata should inform component structure and tokens, not be copied blindly into absolute-positioned CSS.

## VisRefiner

**Methodology extracted**

- Defines screenshot-to-code generation and visual refinement as related tasks.
- Builds `VisDiffUI`, a difference-aligned dataset using renderable HTML/CSS, rule-based perturbations, and model-predicted imperfections.
- Perturbation categories include color, layout, alignment, component, image, and text.
- Trains in two stages:
  - Difference-aligned supervised fine-tuning.
  - GRPO reinforcement learning with self-refinement using rendered visual feedback.

**Task equations**

Screenshot-to-code:

```text
C_gen = f_gen(I_gt),    Render(C_gen) ~= I_gt
```

Refinement:

```text
C_{t+1} = f_refine(I_t, I_gt, C_t)
I_t = Render(C_t)
```

**SFT loss**

```text
L_SFT = -log P_theta(C_{t+1} | I_t, I_gt, C_t)
```

**Relative Improvement Score**

Let:

- `s_t = CLIP(I_t, I_gt)`
- `s_{t+1} = CLIP(I_{t+1}, I_gt)`

Then:

```text
RIS(I_t, I_{t+1}, I_gt) =
  (s_{t+1} - s_t) / (1 - s_t), if s_{t+1} > s_t
  0, otherwise
```

**Composite reward**

```text
r_t = r_format + r_improve + r_quality
```

Where:

- `r_format = -1` for invalid HTML/CSS, otherwise `0`.
- `r_improve = 1` if `s_{t+1} > s_t`, otherwise `0`.
- `r_quality = RIS`.

The appendix notes a small positive improvement threshold to reduce reward noise from tiny renderer differences.

**GRPO pieces**

For group rewards `{r_i}`:

```text
rhat_i = (r_i - mean(r)) / (std(r) + epsilon)
rho_i = pi_theta(C_i | I_gt, I_t, C_t) / pi_theta_old(C_i | I_gt, I_t, C_t)
L_GRPO = -(1/G) * sum_i min(rho_i * rhat_i, clip(rho_i, 1-epsilon, 1+epsilon) * rhat_i)
```

**What this means for Codex**

Codex can adopt the operational loop but not the learned optimization: render current UI, compare to target, describe concrete mismatches, patch code, rerender. The reward and GRPO details justify why "visual difference -> code edit" is a useful training signal, but they are not available unless a VisRefiner-style model is installed.

## UI2Code^N

**Methodology extracted**

- Reframes UI-to-code as interactive visual optimization rather than one-shot generation.
- Defines drafting, polishing, and editing as related transformations.
- Uses VLM-based relative visual judgments instead of relying only on CLIP similarity.
- Trains with continual pretraining, supervised fine-tuning, and reinforcement learning via Relative Visual Policy Optimization.

**Core transformation**

```text
F_theta(I, C, R, E) -> C'
R = Render(C)
```

Where:

- `I`: target UI image.
- `C`: current code.
- `R`: rendered output.
- `E`: optional edit instruction.
- `C'`: updated code.

**Visual optimization objective**

```text
C_star = argmin_C D(I, Render(C))
```

`Render` is treated as a black-box, non-differentiable process.

**UI polishing**

```text
C^{t+1} = F_theta(I, C^t, R^t)
R^t = Render(C^t)
```

**UI editing**

```text
C' = F_theta(I, C, E)
```

**Relative visual preference**

The visual judge induces pairwise preference:

```text
p_psi(y > y' | x) = P[C_psi(x, y, y') = 1]
```

Rank objective:

```text
L_rank(theta) = E_{y,y' ~ pi_theta(.|x)} [ p_psi(y > y' | x) ]
```

Tournament rewards:

```text
o_ij = 1[C_psi(x, y_i, y_j) = 1]
W_i = sum_{j != i} o_ij
```

GRPO uses group-normalized advantages:

```text
A_i = (r_i - mean(r)) / std(r)
J(theta) = E[(1/N) * sum_i min(rho_i*A_i, clip(rho_i, 1-epsilon, 1+epsilon)*A_i)]
```

**Training losses**

Localized DOM grounding:

```text
L_dom(theta) = E_{(I,C),b}[ -sum_n log p_theta(c_{b,n} | c_{b,<n}, I, b) ]
```

Global image-code likelihood:

```text
L_pair(theta) = E_{(I,C)}[ -sum_n log p_theta(c_n | c_{<n}, I) ]
```

**UI polishing reward**

Given reference `A`, initial rendering `B`, polished rendering `C`:

```text
r = 1 if score(A, C) > score(A, B), else 0
```

The paper also reports a threshold-style evaluation where a sample is counted correct if its VLM score is at least 80.

**Key caveat**

CLIP can miss structural layout differences, while VLM-based comparison better aligns with human preferences in the paper's evaluation. For Codex, use screenshots plus concrete visual-delta notes instead of trusting one scalar similarity score.

## WebVIA

**Methodology extracted**

- Addresses the gap between static screenshot-to-code and interactive UI generation.
- Builds a framework with:
  - Exploration agent for multi-state UI discovery.
  - UI2Code model conditioned on multi-state screenshots and interaction graph.
  - Validation module for task-oriented interaction checking.
- Uses Playwright/browser environment interactions, rendered screenshots, and DOM snapshots.

**State/action formalism**

At step `t`, the exploration agent observes:

```text
s_t = (I_t, D_t)
```

Where:

- `I_t`: rendered screenshot.
- `D_t`: DOM snapshot.

It chooses action `a_t` from action space `A` such as clicks, text inputs, selections, and navigation. The environment transitions to `s_{t+1}`.

The agent builds an interaction graph:

```text
G = (S, T)
```

Where:

- `S`: discovered UI states.
- `T`: verified transitions.

The UI2Code model generates code `C_hat` intended to reproduce the visual states and support the verified transitions `T`.

**Training**

- WebVIA-Agent is trained on action generation and interaction verification datasets using supervised fine-tuning.
- Both action prediction and transition verification use cross-entropy loss.
- UI2Code training data aligns multi-state screenshots, interaction traces, and generated interactive HTML/CSS/JavaScript.

**Evaluation metrics**

- Action generation: precision, recall, F1 over predicted interactive actions.
- Interaction verification: pass accuracy and terminate accuracy.
- Pipeline exploration:

```text
Overall = 0.40 * Completeness + 0.35 * Correctness + 0.25 * Deduplication
```

**What this means for Codex**

When the UI is an app, Codex should not stop at a static screenshot match. It should define and test state transitions: click, search, filter, select, navigate, open modal, submit form, and verify that the rendered UI changes as expected.

## Practical Synthesis For The Skill

The robust workflow is grounded as follows:

1. **Structured handoff** comes from Figma2Code's multimodal formulation, but with its maintainability caveat.
2. **Render-and-compare** comes directly from Design2Code's benchmark/evaluation method.
3. **Concrete visual deltas** come from VisRefiner's difference-aligned supervision and refinement task.
4. **Iterative polishing** comes from UI2Code^N's visual optimization formulation.
5. **Interaction-state validation** comes from WebVIA's graph of UI states/transitions.

Codex should represent this as an engineering workflow assembled from paper methods, not as a claim that it implements the papers' training pipelines.

## Residual Gap Closure Additions

Use these methods when pixel mismatch is already low but visible differences remain:

- **Difference-driven refinement:** VisRefiner supports treating `(target screenshot, rendered screenshot, current code) -> improved code` as the core refinement unit. Practical adaptation: keep a rendered diff and patch only variables tied to the observed discrepancy.
- **Relative candidate ranking:** UI2Code^N argues that absolute evaluators can be noisy, so compare candidate variants against each other under execution feedback. Practical adaptation: use bounded local search or variant batches and accept only measured improvements.
- **Layout-aware search:** LayoutCoder identifies element relations and layout trees as critical to preserving UI structure. Practical adaptation: search within layout groups such as heading, paragraph rhythm, buttons, and image blocks instead of arbitrary CSS.
- **Multi-signal evaluation:** Design2Code-style text/layout/color metrics identify whether a pixel gap is real UI error or mostly raster noise. Practical adaptation: after local search, rerun DOM diagnostics to make sure pixel improvements do not degrade text, block geometry, or color.
- **Perceptual metrics as optional GPU escalation:** LPIPS and DISTS show that deep visual features can align better with human perceptual similarity than raw pixel/PSNR-style measures, and DISTS explicitly separates structure and texture similarity. Practical adaptation: use LPIPS/DISTS only as a secondary diagnostic when pixelmatch is dominated by antialiasing, texture, or tiny raster differences.

## Source Links

- Design2Code: `https://arxiv.org/abs/2403.03163`
- Figma2Code: `https://arxiv.org/abs/2604.13648`
- VisRefiner: `https://arxiv.org/abs/2602.05998`
- UI2Code^N: `https://arxiv.org/abs/2511.08195`
- LayoutCoder: `https://arxiv.org/abs/2506.10376`
- LPIPS: `https://arxiv.org/abs/1801.03924`
- DISTS: `https://arxiv.org/abs/2004.07728`
- WebVIA: `https://arxiv.org/abs/2511.06251`
