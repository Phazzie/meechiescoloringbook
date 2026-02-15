// Purpose: Adapter implementation for PromptAssemblySeam.
// Why: Produce a locked prompt template with deterministic content.
// Info flow: Spec + style hint -> canonical prompt text.
import type {
	PromptAssemblyInput,
	PromptAssemblyOutput,
	PromptAssemblySeam
} from '../../../contracts/prompt-assembly.contract';
import type { Result } from '../../../contracts/shared.contract';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import {
	RESERVED_STYLE_HINT_HEADINGS,
	PROMPT_FORBIDDEN_TOKENS,
	borderLine,
	colorModeLine,
	dedicationLine,
	decorationLine,
	fontStyleLine,
	formatListItems,
	illustrationLine,
	negativeLinesForSpec,
	outputLine,
	pageSizeLine,
	shadingLine,
	textStrokeLine
} from '$lib/core/prompt-template';
import { formatAlignmentLine } from '$lib/utils/alignment-line';

const TEMPLATE_VERSION = 'v2';
const MAX_PROMPT_LENGTH = 1024;
const BASE_PAGE_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[0];
const OUTLINE_ONLY_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[1];
const EASY_TO_COLOR_PHRASE = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[2];
const NEGATIVE_PROMPT_HEADING = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[4];

const includesReservedHeading = (styleHint: string): boolean => {
	const normalized = styleHint.toUpperCase();
	return RESERVED_STYLE_HINT_HEADINGS.some((heading) => normalized.includes(heading));
};

const includesForbiddenToken = (styleHint: string): boolean => {
	const lowered = styleHint.toLowerCase();
	return PROMPT_FORBIDDEN_TOKENS.some((token) => lowered.includes(token));
};

const buildPrompt = (input: PromptAssemblyInput): PromptAssemblyOutput => {
	const { spec, styleHint } = input;
	const listItems = formatListItems(spec.items);
	const colorLine = colorModeLine(spec.colorMode);
	const styleLine = styleHint
		? `Vibe: ${styleHint} ${OUTLINE_ONLY_PHRASE}, ${EASY_TO_COLOR_PHRASE}. ${colorLine}`
		: `Vibe: clean worksheet clarity, ${OUTLINE_ONLY_PHRASE}, ${EASY_TO_COLOR_PHRASE}. ${colorLine}`;

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
		`${BASE_PAGE_PHRASE} for print.`,
		'STYLE:',
		`[Describe the vibe. Include ${OUTLINE_ONLY_PHRASE} and ${EASY_TO_COLOR_PHRASE}.]`,
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
		NEGATIVE_PROMPT_HEADING,
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
