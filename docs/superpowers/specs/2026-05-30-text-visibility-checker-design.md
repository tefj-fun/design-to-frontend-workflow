# Text Visibility Checker Design

## Purpose

The skill already says agents should run a DOM text visibility audit before OCR. That instruction is correct: OCR can reveal missing rendered text lines, but it is the wrong first tool for text hidden by CSS, clipped by containers, covered by overlays, or rendered at unreadable contrast. The workflow needs a script that makes those failures measurable before OCR and pixel search.

## Chosen Approach

Add `scripts/visual_text_visibility_check.js`.

The script loads a target page with Playwright and reads a manifest of expected text items. Each item has:

- `id`
- `selector` or `text`
- optional `match`: `contains` or `exact`
- optional `minContrast`
- optional `expectedLineCount`

For each item, the checker reports:

- whether the element exists
- whether it has nonzero client rects
- whether it is hidden by `display`, `visibility`, or `opacity`
- whether it is clipped by an overflow ancestor or outside the viewport
- whether its center point is covered by another element
- estimated foreground/background contrast
- rendered line-box count from `Range.getClientRects()`

It exits nonzero when any expected text fails a visibility check.

## Alternatives Considered

1. Rely on OCR only.
   OCR is useful after rendering, but it cannot explain CSS causes like hidden, clipped, or covered DOM nodes.

2. Add these checks into `visual_ocr_compare.js`.
   That would mix DOM-state auditing with OCR image comparison and make the OCR tool harder to use.

3. Add a standalone DOM visibility checker.
   This is the selected approach because it can run before OCR and can be used as readiness evidence.

## Testing

Create a Playwright fixture with visible text, hidden text, clipped text, covered text, and low-contrast text. The test should assert:

- visible text passes
- hidden/clipped/covered/low-contrast text fails with named item IDs
- the CLI can write an output summary JSON

## Documentation

Update `SKILL.md` and README so the pre-OCR text visibility audit points to `scripts/visual_text_visibility_check.js`.
