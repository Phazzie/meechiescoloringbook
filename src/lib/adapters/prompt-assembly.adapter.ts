// Purpose: Adapter implementation for PromptAssemblySeam.
// Why: Produce a locked prompt template with deterministic content.
// Info flow: Spec + style hint -> canonical prompt text.
import type {
	PromptAssemblyInput,
	PromptAssemblyOutput,
	PromptAssemblySeam
} from '../../../contracts/prompt-assembly.contract';
import type { Result } from '../../../contracts/shared.contract';
import { formatAlignmentLine } from '$lib/utils/alignment-line';

const TEMPLATE_VERSION = 'v2';
const MAX_PROMPT_LENGTH = 1024;
const RESERVED_HEADINGS = [
	'STYLE:',
	'TEXT (EXACT):',
	'TYPOGRAPHY:',
	'LAYOUT:',
	'DECORATIONS:',
	'OUTPUT:',
	'NEGATIVE PROMPT:'
];
const FORBIDDEN_TOKENS = ['size:', 'quality:', 'style:'];

const includesReservedHeading = (styleHint: string): boolean => {
	const normalized = styleHint.toUpperCase();
	return RESERVED_HEADINGS.some((heading) => normalized.includes(heading));
};

const includesForbiddenToken = (styleHint: string): boolean => {
	const lowered = styleHint.toLowerCase();
	return FORBIDDEN_TOKENS.some((token) => lowered.includes(token));
};

const formatListItems = (items: Array<{ number: number; label: string }>): string => {
	const parts = items.map((item) => `${item.number}. ${item.label}`);
	return parts.join('; ');
};

const colorModeLine = (colorMode: PromptAssemblyInput['spec']['colorMode']): string => {
	switch (colorMode) {
		case 'grayscale':
			return 'Color: grayscale.';
		case 'color':
			return 'Color: color.';
		default:
			return 'Color: black and white only.';
	}
};

const pageSizeLine = (pageSize: PromptAssemblyInput['spec']['pageSize']): string =>
	pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

const fontStyleLine = (fontStyle: PromptAssemblyInput['spec']['fontStyle']): string =>
	`Font: ${fontStyle}.`;

const textStrokeLine = (strokeWidth: PromptAssemblyInput['spec']['textStrokeWidth']): string =>
	`Stroke: ${strokeWidth}px.`;

const decorationLine = (decorations: PromptAssemblyInput['spec']['decorations']): string => {
	switch (decorations) {
		case 'minimal':
			return 'Decorations: minimal outline icons.';
		case 'dense':
			return 'Decorations: dense outline icons.';
		default:
			return 'Decorations: none.';
	}
};

const illustrationLine = (illustrations: PromptAssemblyInput['spec']['illustrations']): string => {
	switch (illustrations) {
		case 'simple':
			return 'Illustrations: simple outlines.';
		case 'scene':
			return 'Illustrations: scene outlines.';
		default:
			return 'Illustrations: none.';
	}
};

const shadingLine = (shading: PromptAssemblyInput['spec']['shading']): string => {
	switch (shading) {
		case 'hatch':
			return 'Shading: hatch.';
		case 'stippling':
			return 'Shading: stippling.';
		default:
			return 'Shading: none.';
	}
};

const borderLine = (border: PromptAssemblyInput['spec']['border'], thickness: number): string => {
	switch (border) {
		case 'decorative':
			return `Border: decorative ${thickness}px.`;
		case 'none':
			return 'Border: none.';
		default:
			return `Border: plain ${thickness}px.`;
	}
};

const outputLine = (colorMode: PromptAssemblyInput['spec']['colorMode']): string => {
	switch (colorMode) {
		case 'grayscale':
			return 'Crisp vector-like linework. Grayscale outlines on white. Printable.';
		case 'color':
			return 'Crisp vector-like linework. Colored outlines on white. Printable.';
		default:
			return 'Crisp vector-like linework. Black outlines on white. Printable.';
	}
};

const dedicationLine = (dedication: PromptAssemblyInput['spec']['dedication']): string =>
	dedication ? `Add dedication: "Dedicated to ${dedication}".` : '';

const negativeLinesForSpec = (spec: PromptAssemblyInput['spec']): string[] => {
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

const buildPrompt = (input: PromptAssemblyInput): PromptAssemblyOutput => {
	const { spec, styleHint } = input;
	const listItems = formatListItems(spec.items);
	const colorLine = colorModeLine(spec.colorMode);
	const styleLine = styleHint
		? `Vibe: ${styleHint} outline-only, easy to color. ${colorLine}`
		: `Vibe: clean worksheet clarity, outline-only, easy to color. ${colorLine}`;

	const secondaryLine = spec.footerItem?.label;
	const alignmentLine = formatAlignmentLine(spec);

	const listLine =
		spec.listMode === 'list'
			? `List items: ${listItems} (Gutter: ${spec.listGutter}).`
			: 'No list.';
	const textLines = [
		'TEXT (exact):',
		'[Main quote EXACT — do not alter text.]',
		spec.title,
		'[Secondary line EXACT — omit if none.]',
		...(secondaryLine ? [secondaryLine] : [])
	];

	const alignmentSentence =
		spec.alignment === 'center'
			? `${pageSizeLine(spec.pageSize)} Center the quote. Line 1 headline; line 2 below.`
			: `${pageSizeLine(spec.pageSize)} Left-align the quote. Line 1 headline; line 2 below.`;

	const layoutLines = [
		alignmentSentence,
		'Keep generous whitespace; treat blank space intentional.',
		listLine,
		alignmentLine,
		dedicationLine(spec.dedication)
	].filter((line) => line.length > 0);

	const prompt = [
		'Black-and-white coloring book page for print.',
		'STYLE:',
		'[Describe the vibe. Include outline-only and easy to color.]',
		styleLine,
		...textLines,
		'TYPOGRAPHY:',
		'Bold bubble letters; thick outlines.',
		'Glitter outline only (no shading).',
		`${fontStyleLine(spec.fontStyle)} ${textStrokeLine(spec.textStrokeWidth)}`,
		'LAYOUT:',
		...layoutLines,
		'DECORATIONS:',
		`${decorationLine(spec.decorations)} ${illustrationLine(spec.illustrations)} ${shadingLine(spec.shading)} ${borderLine(spec.border, spec.borderThickness)}`,
		'OUTPUT:',
		outputLine(spec.colorMode),
		'NEGATIVE PROMPT:',
		...negativeLinesForSpec(spec)
	].join('\n');

	return {
		prompt,
		templateVersion: TEMPLATE_VERSION
	};
};

export const promptAssemblyAdapter: PromptAssemblySeam = {
	assemble: async (input: PromptAssemblyInput): Promise<Result<PromptAssemblyOutput>> => {
		if (input.styleHint) {
			if (includesReservedHeading(input.styleHint) || includesForbiddenToken(input.styleHint)) {
				return {
					ok: false,
					error: {
						code: 'STYLE_HINT_CONTAINS_RESERVED_HEADING',
						message: 'Style hint contains a reserved prompt heading.'
					}
				};
			}
		}

		const assembled = buildPrompt(input);
		if (assembled.prompt.length > MAX_PROMPT_LENGTH) {
			return {
				ok: false,
				error: {
					code: 'PROMPT_TOO_LONG',
					message: `Prompt exceeds provider length limit (${MAX_PROMPT_LENGTH}).`
				}
			};
		}

		return {
			ok: true,
			value: assembled
		};
	}
};
