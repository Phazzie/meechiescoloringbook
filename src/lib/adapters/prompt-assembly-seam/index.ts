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
	illustrationLine,
	letteringLine,
	listLineForSpec,
	negativeLinesForSpec,
	outputLine,
	pageSizeLine,
	shadingLine,
	textStrokeLine,
	whitespaceLine
} from '$lib/core/prompt-template';
import { formatAlignmentLine } from '$lib/utils/alignment-line';

// v5 adds the two lines that carry `textSize` and `whitespaceScale`. The version is what a stored
// page records the prompt shape under, so a page made before this exists is identifiable as one
// whose lettering and whitespace fields were decorative.
//
// v6 gives `textStrokeWidth` a single voice: `textStrokeLine` now states the weight in words with
// the pixel figure's own reference, and the `thick outlines` clause that contradicted it from the
// constant above is gone. A page recorded under v5 or earlier had its line weight asked for twice,
// in two different terms, so it is identifiable as one whose stroke field the model could
// legitimately have ignored.
//
// v7 gives `fontStyle` a single voice: `fontStyleLine` now describes the letterform in words, and
// the `Bold bubble letters.` constant that contradicted it from the line above is gone. A page
// recorded under v6 or earlier had its letterform asked for twice, in two incompatible terms, so it
// is identifiable as one whose font field the model could legitimately have ignored — which on the
// thirteen tool and mode pages, all of which build `block`, means every page they ever made.
//
// A value, not a schema. No field is added, removed or retyped anywhere, so no stored record
// becomes unreadable and no migration is implied.
const TEMPLATE_VERSION = 'v7';
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
	const colorLine = colorModeLine(spec.colorMode);
	const styleLine = styleHint
		? `Vibe: ${styleHint} ${OUTLINE_ONLY_PHRASE}, ${EASY_TO_COLOR_PHRASE}. ${colorLine}`
		: `Vibe: clean worksheet clarity, ${OUTLINE_ONLY_PHRASE}, ${EASY_TO_COLOR_PHRASE}. ${colorLine}`;

	const secondaryLine = spec.footerItem?.label;
	const alignmentLine = formatAlignmentLine(spec);

	// listLineForSpec is the single source for this block. DriftDetectionSeam checks the
	// assembled prompt with `prompt.includes(listLineForSpec(spec))`, so building the same
	// text a second time here is how the two silently drift apart; the helper is shared
	// instead. The block spans several lines and still satisfies that substring check
	// because the prompt is joined with the same '\n'.
	const listLine = listLineForSpec(spec);
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
		// Was the constant 'Keep generous whitespace; treat blank space intentional.', which told the
		// model every page wanted generous whitespace no matter what `whitespaceScale` said — and
		// `whitespaceScale` is a required spec field the studio sets to 50, the tools hub to 35 or 45,
		// the interpreter is prompted to choose, and the vault stores and restores. It reached
		// nothing. This line is the field.
		whitespaceLine(spec.whitespaceScale),
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
		// This section used to open with two constants. The first was
		// 'Bold bubble letters; thick outlines.'; Run 25 removed the `thick outlines` half, which
		// was `textStrokeWidth`'s answer stated as a constant that overruled the field.
		//
		// 'Bold bubble letters.' is now gone too, for the same reason and on the other half.
		// Letterform shape is `fontStyleLine`'s answer, and the constant contradicted it: a spec
		// asking for `block` got a prompt demanding bubble letters and then `Font: block.` Bubble
		// letters are inflated and round, block capitals are straight-sided and squared off, and
		// `block` is what every one of the thirteen tool and mode pages builds. So this was not an
		// edge case a rare spec could reach — it was in the prompt of every tool page the app ever
		// sent. The model satisfies one instruction and drops the other, on a paid generation.
		//
		// `Bold` is not lost with it: letter *size* is `letteringLine` ('large, bold letterforms.')
		// and line *weight* is `textStrokeLine`, and both are emitted two lines below.
		//
		// Emitted unconditionally, and it contradicts `Shading: hatch.` and `Shading: stippling.`
		// in the DECORATIONS section below whenever a spec asks for either — and it demands glitter
		// on a page whose reader left the Glitter control off. Same class of defect as the two
		// removed above, belonging to `shading` and to the Glitter control rather than to the
		// letterform. Recorded as a carried-forward finding, not fixed here.
		'Glitter outline only (no shading).',
		// `letteringLine` joins the other two typography lines on one physical line, which is how
		// `fontStyleLine` and `textStrokeLine` have always been emitted: the drift check tests each
		// with `prompt.includes(line)`, so sharing a line costs it nothing. Before it was here the
		// section stated only the constant above, and `textSize` — small, medium or large — changed
		// no byte of the prompt it was carried into.
		`${fontStyleLine(spec.fontStyle)} ${textStrokeLine(spec.textStrokeWidth)} ${letteringLine(spec.textSize)}`,
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
