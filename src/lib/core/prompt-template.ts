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

export const textStrokeLine = (strokeWidth: ColoringPageSpec['textStrokeWidth']): string =>
	`Stroke: ${strokeWidth}px.`;

/**
 * How big the drawn lettering is.
 *
 * Called "Lettering", never "Text size" — `PROMPT_FORBIDDEN_TOKENS` contains `size:`, and the drift
 * check reports every line that carries it. The TYPOGRAPHY section previously stated only the
 * constant 'Bold bubble letters; thick outlines.', so a spec asking for `small` and a spec asking
 * for `large` produced byte-identical prompts.
 */
export const letteringLine = (textSize: ColoringPageSpec['textSize']): string => {
	switch (textSize) {
		case 'medium':
			return 'Lettering: medium, filling about half the sheet height.';
		case 'large':
			return 'Lettering: large, filling most of the sheet.';
		default:
			return 'Lettering: small, leaving the most room to colour.';
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
 */
export const whitespaceLine = (
	whitespaceScale: ColoringPageSpec['whitespaceScale']
): string =>
	`Whitespace: leave about ${Math.round(whitespaceScale)}% of the sheet blank; treat blank space as intentional.`;

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
