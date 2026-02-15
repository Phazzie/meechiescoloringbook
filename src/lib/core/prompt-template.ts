// Purpose: Provide shared prompt-template helpers used by prompt assembly and drift detection.
// Why: Keep prompt wording deterministic and prevent copy drift across seams.
// Info flow: Spec/style inputs -> canonical line builders -> adapters/tests.
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';

export const NEGATIVE_PROMPT_HEADING = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[4];
export const VECTOR_LINEWORK_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[3];

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

export const formatListItems = (items: Array<{ number: number; label: string }>): string => {
	const parts = items.map((item) => `${item.number}. ${item.label}`);
	return parts.join('; ');
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

export const listLineForSpec = (spec: ColoringPageSpec): string =>
	spec.listMode === 'list'
		? `List items: ${formatListItems(spec.items)} (Gutter: ${spec.listGutter}).`
		: 'No list.';

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
	return lines.concat(['no gradients', 'no filled shapes', 'no extra words']);
};
