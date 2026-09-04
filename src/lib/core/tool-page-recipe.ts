// Purpose: Turn any Meechie tool verdict into the coloring page spec that verdict deserves.
// Why: The tools hub could produce eleven kinds of text and zero coloring pages. Several tools
//      already answer in structure — "Fault:"/"Consequence:"/"Move:" prefixes, a ranked "Nth
//      place:" lineup — and flattening all of that into one title-only page throws the structure
//      away. This module decides page type and visual treatment per tool instead.
// Info flow: MeechieToolOutput -> parsed lines -> ColoringPageSpec + styleHint -> /api/generate.
import type { MeechieToolOutput } from '../seams/meechie-tool-seam/contract';
import type { ColoringPageSpec } from '../seams/spec-validation-seam/contract';
import {
	ALLOWED_TEXT_REGEX,
	MAX_DEDICATION_LENGTH,
	MAX_LABEL_LENGTH
} from '../seams/spec-validation-seam/contract';
import { compactColoringPageTitle } from './coloring-page-title';

/** A page recipe is exactly the two things `/api/generate` takes. */
export type ToolPageRecipe = {
	spec: ColoringPageSpec;
	styleHint: string;
};

export type ToolPageRecipeOptions = {
	/** Optional "dedicated to" line the user typed. Sanitized and dropped if it survives empty. */
	dedication?: string;
};

/**
 * The most items a tool page will print. The spec contract allows 20, but a coloring page whose
 * list runs to twenty lines has no blank space left to colour, and blank space is the product.
 */
export const MAX_TOOL_PAGE_ITEMS = 6;

/**
 * Lines the prompt assembler reserves for its own control blocks. A label equal to one of these is
 * rejected by `LabelSchema`, so a verdict that happens to contain one must not become an item.
 * Kept as a lowercase-compare list so "style:" cannot slip through on casing alone.
 */
const RESERVED_LABEL_TEXT = new Set([
	'style:',
	'text (exact):',
	'typography:',
	'layout:',
	'decorations:',
	'output:',
	'negative prompt:'
]);

/**
 * Strip a string down to what `LabelSchema`/`DedicationSchema` actually accept
 * (`ALLOWED_TEXT_REGEX`), collapse the whitespace, and trim. Characters outside the set become a
 * space rather than vanishing, so "claim/reality" reads as "claim reality" and not "claimreality".
 */
const toAllowedText = (value: string): string =>
	value
		.normalize('NFKD')
		// Curly quotes and dashes are the common case and have exact plain equivalents; mapping
		// them first keeps "don't" and "he said — nothing" readable instead of gap-toothed.
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[‒-―]/g, '-')
		.split('')
		.map((char) => (ALLOWED_TEXT_REGEX.test(char) ? char : ' '))
		.join('')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * Words a printed line must not end on. Cutting a sentence at 40 characters routinely lands on a
 * conjunction or a preposition — "he had time to answer and", "he lost the spare key and the" —
 * and a coloring page line that trails off mid-thought reads as a bug, not as a verdict.
 */
const DANGLING_TAIL_WORDS = new Set([
	'a',
	'an',
	'and',
	'as',
	'at',
	'be',
	'because',
	'before',
	'but',
	'by',
	'for',
	'from',
	'in',
	'into',
	'is',
	'like',
	'of',
	'on',
	'or',
	'so',
	'than',
	'that',
	'the',
	'then',
	'to',
	'was',
	'were',
	'with'
]);

/** Coordinators that drag a half-clause behind them when they survive the cut. */
const CLAUSE_STARTERS = new Set(['and', 'but', 'or', 'because', 'so', 'then', 'with', 'before']);

/**
 * Drop a trailing fragment so the line ends on a word that carries meaning.
 *
 * Two passes, because the two failures look different: a line ending *on* a joining word, and a
 * line ending on a joining word plus the one word that followed it before the cut ("and used").
 */
const trimDanglingTail = (value: string): string => {
	let words = value.split(' ').filter((word) => word.length > 0);

	// "…answer and used" — the coordinator is second-to-last, so the clause it opened is a
	// fragment. Cut the coordinator and everything after it.
	if (words.length > 2) {
		const penultimate = words[words.length - 2].toLowerCase().replace(/[^a-z]/g, '');
		if (CLAUSE_STARTERS.has(penultimate)) {
			words = words.slice(0, words.length - 2);
		}
	}

	// "…spare key and" / "…answer to the" — strip joining words off the end until one carries.
	while (words.length > 1) {
		const last = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, '');
		if (!DANGLING_TAIL_WORDS.has(last)) break;
		words = words.slice(0, -1);
	}

	return words.join(' ');
};

/** Trim to a maximum length on a word boundary where one is available. */
const truncateOnWord = (value: string, maxLength: number): string => {
	if (value.length <= maxLength) return value;
	const sliced = value.slice(0, maxLength).trimEnd();
	const lastSpace = sliced.lastIndexOf(' ');
	// Only break on a word if doing so keeps most of the allowance; otherwise a long single word
	// would collapse to almost nothing.
	const kept = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced;
	return trimDanglingTail(kept.replace(/[.,;:-]+$/, '').trim())
		.replace(/[.,;:-]+$/, '')
		.trim();
};

/**
 * Build a printable list label, or `null` when nothing usable survives sanitizing. Returning null
 * rather than a placeholder matters: a page must never print filler the user did not say.
 */
const toLabel = (value: string): string | null => {
	const cleaned = truncateOnWord(toAllowedText(value), MAX_LABEL_LENGTH);
	if (cleaned.length === 0) return null;
	if (RESERVED_LABEL_TEXT.has(cleaned.toLowerCase())) return null;
	return cleaned;
};

const toDedication = (value: string | undefined): string | undefined => {
	if (!value) return undefined;
	const cleaned = truncateOnWord(toAllowedText(value), MAX_DEDICATION_LENGTH);
	return cleaned.length > 0 ? cleaned : undefined;
};

/**
 * Split a tool response into the lines it was actually written as. The tool prompts ask for
 * newline-separated structure ("Fault:" / "Consequence:" / "Move:", or a numbered lineup), but a
 * provider will sometimes return the same structure in one paragraph, so fall back to splitting on
 * sentence ends when there is only a single line.
 */
export const splitResponseLines = (response: string): string[] => {
	const byNewline = response
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (byNewline.length > 1) return byNewline;

	const single = byNewline[0] ?? '';
	if (single.length === 0) return [];
	return single
		.split(/(?<=[.!?])\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
};

/**
 * Pull the "Fault: ... / Consequence: ... / Move: ..." beats out of a verdict.
 *
 * `red_flag_or_run` and `wwmd` are prompted to answer with these exact prefixes, so this is
 * reading a documented shape rather than guessing at prose. Each beat keeps its prefix as the
 * printed label, because on a coloring page "Fault: he had time" is the joke and "he had time"
 * alone is not. Returns an empty array when the verdict came back unstructured, which is the
 * signal to fall back to a full-quote page.
 */
export const extractVerdictBeats = (response: string): string[] => {
	const beats: string[] = [];
	for (const line of splitResponseLines(response)) {
		const match = /^(fault|consequence|move|verdict|receipt)\s*:\s*(.+)$/i.exec(line);
		if (!match) continue;
		const prefix = match[1];
		const beat = match[2].trim();
		if (beat.length === 0) continue;
		// Normalize the prefix casing so a provider answering "FAULT:" and one answering "Fault:"
		// print the same page.
		const titleCased = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
		beats.push(`${titleCased}: ${beat}`);
	}
	return beats;
};

/**
 * Pull the ranked entries out of a `lineup` response.
 *
 * The lineup prompt asks for `Nth place: "item" — comment`, so keep the placing and the item and
 * drop the commentary: the commentary is what makes it too long to print, and the ranking is what
 * makes it a list page. Falls back to a plain numbered line when the em dash is absent.
 */
export const extractRankedEntries = (response: string): string[] => {
	const entries: string[] = [];
	for (const line of splitResponseLines(response)) {
		const match = /^(\d+(?:st|nd|rd|th)?)[).:\s]+\s*(.+)$/i.exec(line);
		if (!match) continue;
		const rest = match[2]
			.replace(/^place\s*[:\-—]?\s*/i, '')
			// Cut the trailing Meechie commentary at the dash the prompt asks for.
			.split(/\s+[–—-]\s+/)[0]
			.replace(/^["'“]|["'”]$/g, '')
			.trim();
		if (rest.length > 0) entries.push(rest);
	}
	return entries;
};

/** Turn printable strings into numbered spec items, dropping any that sanitize away to nothing. */
const toItems = (lines: string[]): ColoringPageSpec['items'] => {
	const items: ColoringPageSpec['items'] = [];
	for (const line of lines.slice(0, MAX_TOOL_PAGE_ITEMS)) {
		const label = toLabel(line);
		if (label === null) continue;
		items.push({ number: items.length + 1, label });
	}
	return items;
};

/**
 * The visual treatment for each tool.
 *
 * `styleHint` follows the house rule that decoration serves the words and matches the subject:
 * courtroom furniture for verdicts, celestial work for the forecast, paper and ink for receipts.
 * `pageStyle` is the part of the spec that differs by page type; everything shared lives in
 * `BASE_SPEC` so a change to the house look happens in one place.
 */
type ToolPresentation = {
	/** Prefer a numbered list page when the verdict parses into one. */
	readonly listSource?: 'beats' | 'ranked';
	readonly styleHint: string;
	readonly pageStyle?: Partial<ColoringPageSpec>;
};

const TOOL_PRESENTATION: Record<MeechieToolOutput['toolId'], ToolPresentation> = {
	red_flag_or_run: {
		listSource: 'beats',
		styleHint:
			'crown, roses with thorns, warning flags, diamonds, bold statement coloring page'
	},
	wwmd: {
		listSource: 'beats',
		styleHint:
			'crown, chess piece, keys, closing door, diamonds, bold statement coloring page'
	},
	lineup: {
		listSource: 'ranked',
		styleHint:
			'courtroom gavel, scales, numbered podium, decorative corner bows, list coloring page'
	},
	rate_excuse: {
		styleHint:
			'gavel, scales, verdict stamp, diamonds, score card, bold statement coloring page'
	},
	apology_translator: {
		styleHint:
			'torn letter, wilting roses, lipstick, diamonds, bold statement coloring page'
	},
	receipts: {
		styleHint:
			'long paper receipt, pen, ledger lines, diamonds, bold statement coloring page'
	},
	caption_this: {
		styleHint:
			'camera flash, sunglasses, perfume bottle, diamonds, glamorous statement coloring page'
	},
	clapback: {
		styleHint:
			'lipstick, manicured hand, sparks, diamonds, bold statement coloring page'
	},
	meechie_explains: {
		styleHint:
			'open dictionary, quotation marks, chains, diamonds, bold statement coloring page'
	},
	horoscope: {
		styleHint:
			'stars, crescent moon, constellation lines, crown, celestial statement coloring page'
	},
	random_meechie: {
		styleHint: 'crown, diamonds, roses with thorns, bold statement coloring page'
	}
};

/**
 * The house look every tool page shares: heavy outlined text, no fills for the user to fight,
 * a decorative border, and enough blank space left to actually colour.
 */
const BASE_SPEC = {
	alignment: 'center',
	numberAlignment: 'strict',
	listGutter: 'normal',
	textSize: 'large',
	fontStyle: 'block',
	textStrokeWidth: 9,
	colorMode: 'black_and_white_only',
	decorations: 'dense',
	illustrations: 'simple',
	shading: 'none',
	border: 'decorative',
	borderThickness: 10,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
} as const satisfies Partial<ColoringPageSpec>;

/**
 * A quote page puts the words in the middle of the sheet and lets the decoration ring them.
 * More whitespace than a list page, because there is only one block of text to place.
 */
const QUOTE_PAGE_STYLE = { whitespaceScale: 35, listGutter: 'normal' } as const;

/**
 * A list page needs the lines to breathe and leaves the bottom of the sheet open, which is the
 * Type B layout the app's reference pages use.
 */
const LIST_PAGE_STYLE = { whitespaceScale: 45, listGutter: 'loose' } as const;

/**
 * Build the page title. `rate_excuse` is the one tool with a numeric verdict, and the score is the
 * whole point of that page, so lead with it rather than burying it in the commentary.
 */
const buildTitle = (output: MeechieToolOutput, forList: boolean): string => {
	if (output.toolId === 'rate_excuse' && typeof output.rating === 'number') {
		return compactColoringPageTitle([`${output.rating}/10`, output.response]);
	}
	// A list page prints its payload as the items, so the title stays as the headline alone and
	// does not repeat the first beat. A quote page has no items, so the response is the page.
	return forList
		? compactColoringPageTitle([output.headline])
		: compactColoringPageTitle([output.headline, output.response]);
};

/**
 * Decide the page a verdict deserves and build the exact spec for it.
 *
 * A tool whose answer parses into structure becomes a numbered list page; everything else becomes
 * a full-quote page. The fallback is never a failure: an unstructured `wwmd` answer is a perfectly
 * good quote page, and printing it as a one-item list would be worse.
 */
export const buildToolPageRecipe = (
	output: MeechieToolOutput,
	options: ToolPageRecipeOptions = {}
): ToolPageRecipe => {
	const presentation = TOOL_PRESENTATION[output.toolId];
	const dedication = toDedication(options.dedication);

	const candidateLines =
		presentation.listSource === 'beats'
			? extractVerdictBeats(output.response)
			: presentation.listSource === 'ranked'
				? extractRankedEntries(output.response)
				: [];
	const items = toItems(candidateLines);
	// One lonely item is a quote wearing a list's clothes. Two is a structure worth printing.
	const useList = items.length >= 2;

	const spec = {
		...BASE_SPEC,
		...(useList ? LIST_PAGE_STYLE : QUOTE_PAGE_STYLE),
		...presentation.pageStyle,
		title: buildTitle(output, useList),
		listMode: useList ? 'list' : 'title_only',
		items: useList ? items : [],
		...(dedication ? { dedication } : {})
	} satisfies ColoringPageSpec;

	return { spec, styleHint: presentation.styleHint };
};
