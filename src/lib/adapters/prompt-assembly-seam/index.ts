// Purpose: Adapter implementation for PromptAssemblySeam.
// Why: Produce a locked prompt template with deterministic content.
// Info flow: Spec + style hint -> canonical prompt text.
import type {
	PromptAssemblyInput,
	PromptAssemblyOutput,
	PromptAssemblySeam
} from '../../seams/prompt-assembly-seam/contract';
import { PromptAssemblyInputSchema } from '../../seams/prompt-assembly-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
	BASE_PAGE_PHRASE,
	EASY_TO_COLOR_PHRASE,
	NEGATIVE_PROMPT_HEADING,
	OUTLINE_ONLY_PHRASE,
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

const TEMPLATE_VERSION = 'v4';
const MAX_PROMPT_LENGTH = 8000;

const includesReservedHeading = (styleHint: string): boolean => {
	const normalized = styleHint.toUpperCase();
	return RESERVED_STYLE_HINT_HEADINGS.some((heading) =>
		normalized.includes(heading)
	);
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
	// The drawable text is instruction-bound and explicitly terminated. Previously this block emitted
	// '[Secondary line EXACT — omit if none.]' unconditionally while the value below it was
	// conditional, so a spec with no footerItem left an empty slot and the image model drew
	// the next physical line — the literal label 'TYPOGRAPHY:' — as the page's second line.
	// The bracketed notes were addressed to a prompt author, not the model, and image models
	// routinely render bracket contents, so they are gone. The terminator closes the block so a
	// bare ALL-CAPS heading cannot read as page copy. It forbids only section labels, not words
	// in general: the LAYOUT section legitimately asks for list items and a dedication further
	// down, and an earlier draft that said "draw no other words" contradicted them.
	// Each drawable value sits alone on the line after its own instruction, and every
	// instruction is emitted only when its value exists. No quoting: ALLOWED_TEXT_REGEX
	// permits a double quote inside a title or label, so wrapping the value in quotes made
	// the delimiter indistinguishable from content for an input like: He said "Go".
	// The empty-slot bug this replaced came from emitting a placeholder whose value was
	// conditional; pairing each instruction with its value makes that shape impossible.
	const textLines = [
		'TEXT (exact):',
		'Headline, render these exact words and nothing else:',
		spec.title,
		...(secondaryLine
			? ['Second line, render these exact words and nothing else:', secondaryLine]
			: []),
		'End of the headline block. Do not draw any section label.'
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
	assemble: async (
		input: PromptAssemblyInput
	): Promise<Result<PromptAssemblyOutput>> => {
		const parsedInput = PromptAssemblyInputSchema.safeParse(input);
		if (!parsedInput.success) {
			return {
				ok: false,
				error: {
					code: 'PROMPT_INPUT_INVALID',
					message: 'Prompt assembly input is invalid.'
				}
			};
		}
		const normalizedInput: PromptAssemblyInput = parsedInput.data.styleHint
			? {
					...parsedInput.data,
					styleHint: parsedInput.data.styleHint.replace(/\s+/g, ' ').trim() || undefined
				}
			: parsedInput.data;
		if (normalizedInput.styleHint) {
			if (includesReservedHeading(normalizedInput.styleHint)) {
				return {
					ok: false,
					error: {
						code: 'STYLE_HINT_CONTAINS_RESERVED_HEADING',
						message: 'Style hint contains a reserved prompt heading.'
					}
				};
			}
			if (includesForbiddenToken(normalizedInput.styleHint)) {
				return {
					ok: false,
					error: {
						code: 'STYLE_HINT_CONTAINS_FORBIDDEN_TOKEN',
						message: 'Style hint contains a forbidden token.'
					}
				};
			}
		}

		const assembled = buildPrompt(normalizedInput);
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
