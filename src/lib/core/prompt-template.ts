// Purpose: Provide shared prompt-template helpers used by prompt assembly and drift detection.
// Why: Keep prompt wording deterministic and prevent copy drift across seams.
// Info flow: Spec/style inputs -> canonical line builders -> adapters/tests.
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';

export const BASE_PAGE_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[0];
export const OUTLINE_ONLY_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[1];
export const EASY_TO_COLOR_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[2];
export const VECTOR_LINEWORK_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[3];
export const NEGATIVE_PROMPT_HEADING = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[4];

export const PROMPT_REQUIRED_HEADINGS = [
	'STYLE:',
	'TEXT (exact):',
	'TYPOGRAPHY:',
	'LAYOUT:',
	'DECORATIONS:',
	'OUTPUT:',
	NEGATIVE_PROMPT_HEADING
];

export const PROMPT_FORBIDDEN_TOKENS = ['size:', 'quality:', 'style:'];

export const RESERVED_STYLE_HINT_HEADINGS = [
	'STYLE:',
	'TEXT (EXACT):',
	'TYPOGRAPHY:',
	'LAYOUT:',
	'DECORATIONS:',
	'OUTPUT:',
	NEGATIVE_PROMPT_HEADING
];

// One item per line. This previously joined with '; ' and three live generations against
// grok-imagine-image-2.0 came back with those semicolons drawn onto the page as visible
// lettering, on a sheet a customer colours in. The image model treats the separator as
// content, so the separator has to go: the newline carries the same grouping and is never
// rendered as a glyph.
export const formatListItems = (items: Array<{ number: number; label: string }>): string => {
	const parts = items.map((item) => `${item.number}. ${item.label}`);
	return parts.join('\n');
};

export const colorModeLine = (colorMode: ColoringPageSpec['colorMode']): string => {
	switch (colorMode) {
		case 'grayscale':
			return 'Color: grayscale.';
		case 'color':
			return 'Color: color.';
		default:
			return 'Color: black and white only.';
	}
};

export const pageSizeLine = (pageSize: ColoringPageSpec['pageSize']): string =>
	pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

export const fontStyleLine = (fontStyle: ColoringPageSpec['fontStyle']): string =>
	`Font: ${fontStyle}.`;

/**
 * How thick the drawn outlines are — the one property that decides whether a printed page can be
 * coloured inside at all.
 *
 * This used to be `Stroke: ${strokeWidth}px.` and nothing else: the only bare number in the whole
 * prompt, emitted against a 1024x1024 generation that is then letterboxed onto US Letter at 300dpi,
 * with nothing anywhere saying what those pixels were measured against. Every other line in
 * TYPOGRAPHY, DECORATIONS and LAYOUT describes the thing it is asking for. This one asked the model
 * to infer a scale it was never given, on the field where the scale *is* the instruction.
 *
 * Two changes, and the second is the one that mattered:
 *
 * 1. The number now states its own reference — `on a 1024px sheet` — which is
 *    `DEFAULT_IMAGE_SIZE` in `image-generation-pipeline.ts`. If that constant ever changes, this
 *    sentence becomes false, which is why `tests/unit/drift-detection-helpers.test.ts` asserts the
 *    two agree rather than leaving them to drift.
 * 2. It says the weight in words, because the words are what the model can actually follow. The
 *    number stays because the drift check matches this line exactly and because a stored spec's
 *    real value is the thing being reported.
 *
 * **The TYPOGRAPHY section used to contradict this line four lines above it.** It opened with the
 * constant `'Bold bubble letters; thick outlines.'`, so a spec asking for `textStrokeWidth: 4` —
 * the thinnest the contract allows — produced a prompt demanding *thick outlines* and then
 * `Stroke: 4px.` That is the same defect a review of PR #350 named for `whitespaceScale`: two
 * instructions in one prompt each claiming to set the same property. Contradictory instructions do
 * not fail. They make the model satisfy one and quietly drop the other, on a generation the reader
 * has paid for. The `thick outlines` clause is gone; this line is the only voice on line weight.
 *
 * Deliberately says nothing about letterform *shape* or *size* — those are `fontStyleLine` and
 * `letteringLine`, sharing the same physical line. One field, one instruction, which is the rule
 * that whole review round earned.
 *
 * No rounding and no clamp, unlike `whitespaceLine`: `ColoringPageSpecSchema` declares this field
 * `z.number().int().min(4).max(12)`, so every value that reaches here is already a whole number
 * inside a range the model can carry. A clamp here would be unreachable code pretending to be a
 * guard.
 */
export const LINE_WEIGHT_REFERENCE_PX = 1024;

const strokeWeightWord = (strokeWidth: number): string => {
	if (strokeWidth <= 5) return 'fine';
	if (strokeWidth <= 7) return 'medium-weight';
	if (strokeWidth <= 10) return 'bold';
	return 'very thick';
};

export const textStrokeLine = (strokeWidth: ColoringPageSpec['textStrokeWidth']): string =>
	`Stroke: ${strokeWeightWord(strokeWidth)} outlines, about ${strokeWidth}px wide on a ${LINE_WEIGHT_REFERENCE_PX}px sheet.`;

/**
 * How big the drawn lettering is.
 *
 * Called "Lettering", never "Text size" — `PROMPT_FORBIDDEN_TOKENS` contains `size:`, and the drift
 * check reports every line that carries it. The TYPOGRAPHY section previously stated only the
 * constant 'Bold bubble letters; thick outlines.', so a spec asking for `small` and a spec asking
 * for `large` produced byte-identical prompts.
 *
 * Describes the **letterforms** and deliberately says nothing about how much of the sheet they
 * cover. The first draft read "large, filling most of the sheet" and "small, leaving the most room
 * to colour", which a review of PR #350 correctly called a contradiction: how much of the sheet is
 * covered is `whitespaceScale`'s answer, and two lines in one prompt each claiming to set page
 * occupancy force the model to pick one and ignore the other — on a request the reader has paid
 * for. One field, one instruction. The reader-facing help in `page-style.ts` may still talk about
 * room to colour, because a reader is choosing between the two together; the prompt may not,
 * because the model is following both at once.
 */
export const letteringLine = (textSize: ColoringPageSpec['textSize']): string => {
	switch (textSize) {
		case 'medium':
			return 'Lettering: medium letterforms.';
		case 'large':
			return 'Lettering: large, bold letterforms.';
		default:
			return 'Lettering: small, compact letterforms.';
	}
};

/**
 * How much of the sheet is left blank for the reader to colour.
 *
 * `whitespaceScale` is a 0-100 `ColoringPageSpec` field that until now reached nothing at all — not
 * this prompt, not the drift check, not packaging. It replaces the constant sentence
 * 'Keep generous whitespace; treat blank space intentional.', which claimed *generous* whitespace
 * for every page including one whose spec asked for almost none.
 *
 * Higher means more blank space. Nothing in the repository established that before this line
 * existed, because nothing read the field; the name, and `constants.ts` handing the interpreter 50
 * as the neutral default, are what it rests on. Stated here in the prompt itself so the meaning is
 * checkable against a generated page rather than inferred from a variable name.
 *
 * The value is rounded because the contract admits any number in range and a prompt reading
 * "about 47.5%" invites the model to draw the figure.
 *
 * It is also **clamped**, which is the part worth explaining. The contract admits 0 to 100, and both
 * ends are instructions no page can carry: every page in this app draws an exact headline, so "leave
 * 100% of the sheet blank" and "leave 0% blank" each contradict the TEXT block in the same prompt. A
 * review of PR #350 caught the 100 case. Contradictory instructions do not fail — they make the
 * model pick one and silently ignore the other, on a generation the reader has paid for.
 *
 * So the encoder saturates rather than repeating an impossible number: a spec asking for 95 and one
 * asking for 100 both ask for `MAX`. That is a deliberate, documented loss, and it is confined to
 * this one function — the contract, the stored spec and the reader's control all keep the real
 * value.
 */
export const MIN_PROMPTABLE_WHITESPACE = 5;
export const MAX_PROMPTABLE_WHITESPACE = 85;

export const whitespaceLine = (
	whitespaceScale: ColoringPageSpec['whitespaceScale']
): string => {
	const promptable = Math.min(
		MAX_PROMPTABLE_WHITESPACE,
		Math.max(MIN_PROMPTABLE_WHITESPACE, Math.round(whitespaceScale))
	);
	return `Whitespace: leave about ${promptable}% of the sheet blank around the drawn content; treat blank space as intentional.`;
};

export const decorationLine = (decorations: ColoringPageSpec['decorations']): string => {
	switch (decorations) {
		case 'minimal':
			return 'Decorations: minimal outline icons.';
		case 'dense':
			return 'Decorations: dense outline icons.';
		default:
			return 'Decorations: none.';
	}
};

export const illustrationLine = (illustrations: ColoringPageSpec['illustrations']): string => {
	switch (illustrations) {
		case 'simple':
			return 'Illustrations: simple outlines.';
		case 'scene':
			return 'Illustrations: scene outlines.';
		default:
			return 'Illustrations: none.';
	}
};

export const shadingLine = (shading: ColoringPageSpec['shading']): string => {
	switch (shading) {
		case 'hatch':
			return 'Shading: hatch.';
		case 'stippling':
			return 'Shading: stippling.';
		default:
			return 'Shading: none.';
	}
};

export const borderLine = (border: ColoringPageSpec['border'], thickness: number): string => {
	switch (border) {
		case 'decorative':
			return `Border: decorative ${thickness}px.`;
		case 'none':
			return 'Border: none.';
		default:
			return `Border: plain ${thickness}px.`;
	}
};

export const outputLine = (colorMode: ColoringPageSpec['colorMode']): string => {
	switch (colorMode) {
		case 'grayscale':
			return `${VECTOR_LINEWORK_PHRASE}. Grayscale outlines on white. Printable.`;
		case 'color':
			return `${VECTOR_LINEWORK_PHRASE}. Colored outlines on white. Printable.`;
		default:
			return `${VECTOR_LINEWORK_PHRASE}. Black outlines on white. Printable.`;
	}
};

export const dedicationLine = (dedication: ColoringPageSpec['dedication']): string =>
	dedication ? `Add dedication: "Dedicated to ${dedication}".` : '';

// The instruction is spelled out for the model rather than left implicit: naming the
// one-per-line, numbered shape and explicitly forbidding the separator is what the verified
// generation used. The gutter keeps its existing inline-parenthetical treatment and sits
// ahead of the instruction so nothing follows the item block - a trailing line after the
// items is exactly the shape that gets mistaken for another item and drawn.
const LIST_ITEMS_INSTRUCTION =
	'(render each on its own line, numbered, without the separator punctuation)';

export const listLineForSpec = (spec: ColoringPageSpec): string => {
	if (spec.listMode !== 'list') {
		return 'No list.';
	}
	const heading = `List items (Gutter: ${spec.listGutter}) ${LIST_ITEMS_INSTRUCTION}:`;
	const itemLines = formatListItems(spec.items);
	return itemLines ? `${heading}\n${itemLines}` : heading;
};

export const negativeLinesForSpec = (spec: ColoringPageSpec): string[] => {
	const lines: string[] = [];
	if (spec.colorMode !== 'color') {
		lines.push('no color');
	}
	if (spec.colorMode === 'black_and_white_only') {
		lines.push('no grayscale');
	}
	if (spec.shading === 'none') {
		lines.push('no shading');
	}
	return lines.concat([
		'no gradients',
		'no filled shapes',
		'no extra words',
		'no semicolons or trailing punctuation after a list item'
	]);
};
