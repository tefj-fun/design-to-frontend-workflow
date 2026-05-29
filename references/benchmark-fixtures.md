# Benchmark Fixtures

Use this reference when forward-testing the skill itself. It points to public, repeatable design-to-code benchmark samples rather than project-specific mockups.

## Recommended First Fixture: Design2Code Sample 1002

Design2Code publishes screenshot/HTML pairs in the `SALT-NLP/Design2Code` Hugging Face dataset. Sample `1002` is a small 1280x720 webpage, making it a good smoke test for the skill.

Files:

- Reference screenshot: `https://huggingface.co/datasets/SALT-NLP/Design2Code/resolve/main/1002.png`
- Source HTML: `https://huggingface.co/datasets/SALT-NLP/Design2Code/resolve/main/1002.html`
- Source URL mapping: `https://raw.githubusercontent.com/NoviScl/Design2Code/main/id_to_url_mapping.json`

The `1002.html` source maps to:

```text
https://www.displaycabinets2go.com/C-29412/Wall-Mounted-Display-Cabinets-for-Trophies-Collectibles?so=PriceDesc&ipp=48&dt=Grid&fq%5B0%5D=class%3A%281099%29&fq%5B1%5D=class%3A%281104%29
```

Observed source-of-truth traits:

- Viewport: `1280x720`.
- Content: a simple announcement page headed "We Have Some Exciting News!".
- Visual structure: centered content column, blue logo/image placeholder, headline, three paragraphs, two dark buttons.
- Interaction scope: static links only; use this fixture for screenshot-to-code and visual parity, not WebVIA-style interaction validation.

## Forward-Test Procedure

1. Download the `png/html` pair into a scratch directory outside the target repo.
2. Inspect the screenshot and create the lightweight handoff:
   - layout hierarchy,
   - text inventory,
   - typography and spacing guesses,
   - asset uncertainty,
   - viewport.
3. Produce a candidate implementation from the screenshot only.
4. Render the candidate at `1280x720`.
5. Compare rendered candidate against `1002.png`.
6. Record visual deltas in implementation terms.
7. If using the released `1002.html` as a control, render it too and compare against `1002.png`.

Use the bundled script when dependencies are available:

```bash
NODE_PATH=/path/to/node_modules node scripts/visual_compare.js \
  --reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --target /tmp/design-to-frontend-forward-test/design2code-1002/candidate.html \
  --rendered /tmp/design-to-frontend-forward-test/design2code-1002/candidate-1280x720.png \
  --diff /tmp/design-to-frontend-forward-test/design2code-1002/diff-reference-candidate.png \
  --width 1280 \
  --height 720 \
  --threshold 0.1
```

For iterative refinement, create a template with placeholders for measured implementation variables and a variants file with plausible candidate patches:

```bash
NODE_PATH=/path/to/node_modules node scripts/visual_refine_loop.js \
  --reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --template /tmp/design-to-frontend-forward-test/design2code-1002/candidate-loop-template.html \
  --variants /tmp/design-to-frontend-forward-test/design2code-1002/candidate-loop-variants.json \
  --output-dir /tmp/design-to-frontend-forward-test/design2code-1002/loop-output \
  --width 1280 \
  --height 720 \
  --threshold 0.1 \
  --max-iterations 12 \
  --grid-cols 4 \
  --grid-rows 4
```

When the benchmark includes source HTML, add DOM diagnostics to the final compare:

```bash
NODE_PATH=/path/to/node_modules node scripts/visual_compare.js \
  --reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --reference-html /tmp/design-to-frontend-forward-test/design2code-1002/source.html \
  --target /tmp/design-to-frontend-forward-test/design2code-1002/loop-output-search3/iteration-01-26-buttonMarginBottom-8px.html \
  --rendered /tmp/design-to-frontend-forward-test/design2code-1002/diagnostic-final-1280x720.png \
  --diff /tmp/design-to-frontend-forward-test/design2code-1002/diagnostic-final-diff.png \
  --width 1280 \
  --height 720 \
  --threshold 0.1
```

When the refined candidate plateaus, run bounded local search over tunable template variables:

```bash
NODE_PATH=/path/to/node_modules node scripts/visual_local_search.js \
  --reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --template /tmp/design-to-frontend-forward-test/design2code-1002/candidate-loop-template.html \
  --search-space /tmp/design-to-frontend-forward-test/design2code-1002/local-search-space.json \
  --output-dir /tmp/design-to-frontend-forward-test/design2code-1002/local-search-output-fast \
  --width 1280 \
  --height 720 \
  --threshold 0.1 \
  --max-passes 8
```

For text-heavy pages, run OCR line-position diagnostics on the final rendered PNG:

```bash
NODE_PATH=/path/to/node_modules node scripts/visual_ocr_compare.js \
  --reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --candidate /tmp/design-to-frontend-forward-test/design2code-1002/local-search-final-verify-2-1280x720.png \
  --psm 6 \
  --min-confidence 25 \
  --min-similarity 0.35
```

If the pixel-best candidate hides lines or changes text wrapping, run OCR-aware local search:

```bash
NODE_PATH=/path/to/node_modules node scripts/visual_ocr_local_search.js \
  --reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --ocr-reference /tmp/design-to-frontend-forward-test/design2code-1002/reference.png \
  --template /tmp/design-to-frontend-forward-test/design2code-1002/candidate-loop-template.html \
  --search-space /tmp/design-to-frontend-forward-test/design2code-1002/ocr-local-search-space.json \
  --output-dir /tmp/design-to-frontend-forward-test/design2code-1002/ocr-local-search-output-guarded \
  --width 1280 \
  --height 720 \
  --threshold 0.1 \
  --max-passes 6 \
  --psm 6 \
  --min-confidence 25 \
  --min-similarity 0.35 \
  --max-mismatch-percent 4.0
```

When source HTML exists, probe computed typography before creating the search space:

```bash
NODE_PATH=/path/to/node_modules node scripts/typography_probe.js \
  --target /tmp/design-to-frontend-forward-test/design2code-1002/source.html \
  --base-search-space /tmp/design-to-frontend-forward-test/design2code-1002/ocr-local-search-space.json \
  --output /tmp/design-to-frontend-forward-test/design2code-1002/typography-search-space.json \
  --width 1280 \
  --height 720
```

## Baseline Forward-Test Result From This Machine

A scratch forward-test was run at:

```text
/tmp/design-to-frontend-forward-test/design2code-1002/
```

Artifacts created:

- `reference.png`: downloaded official `1002.png`.
- `source.html`: downloaded official `1002.html`.
- `candidate.html`: hand-built candidate following this skill.
- `candidate-1280x720.png`: rendered candidate.
- `source-render-1280x720.png`: rendered released source HTML.
- `diff-reference-candidate.png`: pixel diff between reference and candidate.
- `diff-reference-source.png`: pixel diff between reference and source render.

Pixelmatch at `1280x720`, threshold `0.1`:

- Reference vs first-pass candidate: `36,502 / 921,600` mismatched pixels, `3.96%`.
- Reference vs optimized candidate: `29,477 / 921,600` mismatched pixels, `3.20%`.
- Reference vs loop-refined candidate: `18,965 / 921,600` mismatched pixels, `2.06%`.
- Reference vs local-search candidate: `17,390 / 921,600` mismatched pixels, `1.89%`.
- Reference vs OCR-aware local-search candidate: `21,449 / 921,600` mismatched pixels, `2.33%`.
- Reference vs typography-probed OCR-search candidate: `31,592 / 921,600` mismatched pixels, `3.43%`.
- Reference vs released source render: `36,902 / 921,600` mismatched pixels, `4.00%`.

DOM diagnostics for the loop-refined candidate against the benchmark source HTML:

- Text similarity: `1.0000` (`433 / 433` visible characters).
- Layout score: `0.9810` with `8 / 9` reference blocks matched.
- Position score: `0.9922`.
- Size score: `0.9698`.
- Color score: `0.9750`.
- Worst matched blocks: `FAQs`, heading, primary button, and the first two body paragraphs.

DOM diagnostics for the local-search candidate against the benchmark source HTML:

- Text similarity: `1.0000` (`433 / 433` visible characters).
- Layout score: `0.9783` with `8 / 9` reference blocks matched.
- Position score: `0.9912`.
- Size score: `0.9655`.
- Color score: `0.9750`.
- Accepted local-search changes: `h1LineHeight: 1.15`, `buttonFontSize: 20px`, `buttonPaddingX: 14px`, and `smallButtonFontSize: 17px`.

OCR line-position diagnostics for the local-search candidate against the GT screenshot:

- GT OCR lines: `9`; candidate OCR lines: `8`.
- Matched OCR lines: `8`.
- Missing GT line: `customer service.`.
- Average absolute top delta: `7.50px`.
- Max absolute top delta: `21px`.
- Worst deltas:
  - `Get to your favorite items...`: `dy=-21px`, `dw=-61px`.
  - `Displays2go.com.`: `dy=-16px`.
  - `Need more information?`: `dy=-10px`.

This means the `1.89%` pixel score is not enough to call the local-search candidate visually better. It reduced global pixel mismatch but still has a text wrapping/line-position mismatch. For this fixture, OCR line diagnostics should gate acceptance after pixel/local-search refinement.

OCR-aware local-search result against the GT screenshot:

- Pixel mismatch: `21,449 / 921,600`, `2.33%`.
- GT OCR lines: `9`; candidate OCR lines: `9`.
- Matched OCR lines: `9`.
- Missing GT lines: `0`.
- Missing candidate lines: `0`.
- Average absolute top delta: `2.22px`.
- Max absolute top delta: `3px`.
- Average absolute width delta: `4.22px`.
- Accepted OCR-aware changes: `bodyFontWeight: 600`, `paragraphMarginBottom: 18px`, `buttonMarginBottom: 12px`, `buttonFontSize: 19px`, `buttonMarginTop: 0`, and `mainTopMargin: 62px`.
- Side-by-side visual artifact from this run: `/tmp/design-to-frontend-forward-test/design2code-1002/ocr-aware-best-vs-gt.png`.

The OCR-aware candidate is the better accepted candidate for this text-heavy fixture even though its pixel mismatch is higher than the pixel-only `1.89%` candidate. The pixel-only candidate hides the `customer service.` line; the OCR-aware candidate preserves all detected text lines and keeps line positions within `3px`.

Typography-probed OCR-search result:

- Probe extracted source HTML typography: paragraph/body-like text `"Open Sans", 18px, weight 500, line-height 1.5`; heading `24px/1.5`; button `18px/1.43`.
- Pixel mismatch: `31,592 / 921,600`, `3.43%`.
- OCR with exploratory `--min-similarity 0.35`: `9 / 9` lines matched, but average left delta was `33.44px` and average width delta was `56.11px`.
- OCR with strict `--min-similarity 0.85`: `8 / 9` lines matched; missing GT line `customer service.` and extra candidate line `service.`.
- Do not accept this candidate for sample `1002`. The typography probe was useful diagnostically, but the source HTML typography did not match the benchmark screenshot render closely enough. Keep the OCR-aware local-search candidate at `2.33%`.

Observed candidate deltas:

- First-pass candidate was visually close in structure and content.
- First-pass typography and spacing still differed enough to require refinement.
- A failed refinement attempt worsened mismatch from `3.96%` to `4.00%`, which is why measured rerendering matters.
- The optimized candidate improved by increasing body type to `19px`, using the original `788px` column width, setting top margin to `61px`, setting logo gap to `55px`, and increasing paragraph bottom margin to `22px`.
- The loop-refined candidate improved the optimized candidate by accepting measured spacing changes: `paragraphMarginBottom: 29px` and `buttonMarginBottom: 8px`. The loop rejected coarse text-flow and font-family changes that worsened global mismatch.
- The local-search candidate improved the loop-refined candidate by applying bounded coordinate search over heading and button parameters. It reduced pixel mismatch below `2%`, while DOM diagnostics showed text stayed exact and layout/color stayed high. OCR diagnostics then exposed that rendered line wrapping was still wrong, so this candidate should be reported as pixel-improved but not visually solved.
- The OCR-aware local-search candidate corrected the text-flow failure by accepting a temporary pixel regression for `bodyFontWeight: 600`, then reducing spacing mismatch through paragraph and button margin changes. It is a better smoke-test pass because it satisfies the text-line acceptance gate.
- The typography-probed search showed why computed CSS is not automatically ground truth: the source declares `"Open Sans"` but local `document.fonts` had no loaded font faces, and the probe path narrowed content width to recover line count. Strict OCR rejected the result.
- The highest remaining regional mismatch after loop refinement was in the center text/button area: grid row `2`, column `1`, with `5,534 / 57,600` mismatched pixels (`9.61%`).
- Pixel-level diff penalized text antialiasing heavily, so visual review is still required.

Use this fixture as a smoke test, not as a final benchmark score. A robust project implementation still needs project-specific mockups, responsive breakpoints, and interaction checks.

## Whether To Chase Paper References

Do not recursively read every cited reference from every paper by default. Use targeted references only when they change the workflow or explain a concrete failure mode.

Useful reference categories:

- Historical baseline: early screenshot-to-code work such as pix2code.
- Dataset lineage: WebSight, Vision2UI, Web2Code, Flame/Flame-React, Design2Code-HARD.
- Interactive UI validation: Interaction2Code, FullFront, Web agent benchmarks.
- Evaluation metrics: CLIP/DINO visual similarity, text/element matching, CIEDE2000, human/VLM judge alignment.
- Figma implementation tooling: FigmaToCode and related Figma IR/template conversion tools.

Default rule: read the five main papers first, then add cited references only for gaps found during forward-testing.
