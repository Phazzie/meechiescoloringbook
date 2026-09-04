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
	LabelSchema,
	MAX_DEDICATION_LENGTH,
	MAX_LABEL_LENGTH,
	MAX_TITLE_LENGTH,
	TitleSchema
} from '../seams/spec-validation-seam/contract';
import { compactColoringPageTitle } from './coloring-page-title';
import { MeechieStudioTextOutputSchema } from '../../../contracts/meechie-studio-text.contract';
import type { MeechieStudioTextOutput } from '../../../contracts/meechie-studio-text.contract';

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

/** Reduce a word to its bare letters so punctuation cannot hide a joining word. */
const bareWord = (word: string): string => word.toLowerCase().replace(/[^a-z]/g, '');

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
	if (words.length > 2 && CLAUSE_STARTERS.has(bareWord(words.at(-2) ?? ''))) {
		words = words.slice(0, -2);
	}

	// "…spare key and" / "…answer to the" — strip joining words off the end until one carries.
	while (words.length > 1 && DANGLING_TAIL_WORDS.has(bareWord(words.at(-1) ?? ''))) {
		words = words.slice(0, -1);
	}

	return words.join(' ');
};

/**
 * Strip trailing sentence punctuation.
 *
 * A scan rather than `/[.,;:-]+$/`: an end-anchored quantified class re-tries from every position
 * in a long punctuation run that ends in a non-matching character, which is quadratic. Walking
 * backwards from the end is linear and does the same job.
 */
const trimTrailingPunctuation = (value: string): string => {
	let end = value.length;
	while (end > 0 && '.,;:-'.includes(value[end - 1])) end -= 1;
	return value.slice(0, end);
};

/** Trim to a maximum length on a word boundary where one is available. */
const truncateOnWord = (value: string, maxLength: number): string => {
	if (value.length <= maxLength) return value;
	const sliced = value.slice(0, maxLength).trimEnd();
	const lastSpace = sliced.lastIndexOf(' ');
	// Only break on a word if doing so keeps most of the allowance; otherwise a long single word
	// would collapse to almost nothing.
	const kept = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced;
	return trimTrailingPunctuation(
		trimDanglingTail(trimTrailingPunctuation(kept).trim())
	).trim();
};

/**
 * Build a printable list label, or `null` when nothing usable survives sanitizing. Returning null
 * rather than a placeholder matters: a page must never print filler the user did not say.
 */
const toLabel = (value: string): string | null => {
	const cleaned = truncateOnWord(toAllowedText(value), MAX_LABEL_LENGTH);
	if (cleaned.length === 0) return null;
	// Ask the schema that owns the rule rather than re-stating it. A hand-kept copy of the prompt
	// assembler's reserved control lines was missing three of the contract's ten, and would have
	// drifted again the next time that list changed.
	return LabelSchema.safeParse(cleaned).success ? cleaned : null;
};

const toDedication = (value: string | undefined): string | undefined => {
	if (!value) return undefined;
	const cleaned = truncateOnWord(toAllowedText(value), MAX_DEDICATION_LENGTH);
	return cleaned.length > 0 ? cleaned : undefined;
};

/**
 * Collapse runs of whitespace to single spaces and trim.
 *
 * Every line handed downstream goes through this, which is what keeps the parsing patterns below
 * linear: a provider is free to return a line containing thousands of consecutive spaces, and a
 * pattern like `\s+[-]\s+` scanned across that run backtracks quadratically. Normalizing once, in
 * a single linear pass, removes the pathological input rather than hardening each pattern against
 * it. Collapsing internal whitespace is lossless for this use — labels are whitespace-collapsed by
 * `toAllowedText` anyway, and a coloring page never prints a run of spaces.
 */
const collapseWhitespace = (line: string): string => line.replace(/\s+/g, ' ').trim();

/**
 * Split a tool response into the lines it was actually written as. The tool prompts ask for
 * newline-separated structure ("Fault:" / "Consequence:" / "Move:", or a numbered lineup), but a
 * provider will sometimes return the same structure in one paragraph, so fall back to splitting on
 * sentence ends when there is only a single line.
 */
export const splitResponseLines = (response: string): string[] => {
	const byNewline = response
		.split(/\r?\n/)
		.map(collapseWhitespace)
		.filter((line) => line.length > 0);
	if (byNewline.length > 1) return byNewline;

	const single = byNewline[0] ?? '';
	if (single.length === 0) return [];
	return single
		.split(/(?<=[.!?]) /)
		.map(collapseWhitespace)
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
/**
 * Split a one-line verdict at its prefixes rather than at its sentence ends.
 *
 * `splitResponseLines` breaks a single line after every `. `, which corrupts a beat containing an
 * abbreviation: `Fault: Dr. Smith lied. Consequence: no access.` became `Fault: Dr.` plus two
 * fragments, and the page printed `Fault: Dr.`. The prefixes are the real boundaries, so split on
 * them and leave the prose inside each beat alone.
 */
const splitBeatLines = (response: string): string[] => {
	const lines = response
		.split(/\r?\n/)
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line.length > 0);
	return lines
		// Split only where a prefix *starts a beat*: at the beginning of the line, or after a
		// sentence end. An unanchored lookahead also fired on a prefix word appearing inside the
		// prose — `Fault: The receipt: proves he lied.` split at `receipt:` and relabelled the
		// verdict — while still needing to avoid splitting at abbreviations like `Dr.`
		.flatMap((line) =>
			line.split(/(?<=[.!?] )(?=\b(?:fault|consequence|move|verdict|receipt) ?:)/i)
		)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
};

export const extractVerdictBeats = (response: string): string[] => {
	const beats: string[] = [];
	for (const line of splitBeatLines(response)) {
		// Lines arrive whitespace-collapsed, so a single optional space is all that can separate
		// the prefix from its colon. Spelling that out keeps the pattern linear.
		const match = /^(fault|consequence|move|verdict|receipt) ?: ?(.+)$/i.exec(line);
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
 * If the text opens with a quote, return everything up to its matching close.
 *
 * This is what lets a ranked item keep a dash of its own: the lineup prompt wraps the item in
 * quotes and puts its commentary after an em dash, so the closing quote — not the first spaced
 * dash — is the boundary. Returns null when the text is not quoted or the quote never closes, so
 * the caller can fall back to the dash split.
 */
const readQuotedPrefix = (value: string): string | null => {
	const openers: Record<string, string> = { '"': '"', "'": "'", '“': '”' };
	const closer = openers[value[0]];
	if (!closer) return null;
	const end = value.indexOf(closer, 1);
	if (end <= 0) return null;
	return value.slice(1, end);
};

/** Strip one layer of wrapping quotes from a ranked entry, which the lineup prompt asks for. */
const trimQuotes = (value: string): string => {
	const opening = new Set(['"', "'", '“']);
	const closing = new Set(['"', "'", '”']);
	let start = 0;
	let end = value.length;
	if (end > start && opening.has(value[start])) start += 1;
	if (end > start && closing.has(value[end - 1])) end -= 1;
	return value.slice(start, end);
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
		// Match only the leading placing, then walk past the separator by hand.
		//
		// Every quantified-class-followed-by-`(.+)` form of this is ambiguous — `.` matches the
		// separator characters too, so the engine re-splits the boundary on every backtrack, which
		// is what made the original `[).:\s]+\s*(.+)$` catastrophic and its narrowed `[).: ]+(.+)$`
		// successor merely quadratic. Anchoring on the number alone and scanning the separator
		// removes the ambiguity rather than shrinking it. `\d{1,3}` because the spec contract caps
		// an item number at 999.
		const match = /^(\d{1,3})(?:st|nd|rd|th)?/i.exec(line);
		if (!match) continue;
		let cursor = match[0].length;
		while (cursor < line.length && ').: '.includes(line[cursor])) cursor += 1;
		// A placing has to be followed by a separator; "3rd" alone, or "12x", is not a ranked line.
		if (cursor === match[0].length || cursor === line.length) continue;
		const body = line
			.slice(cursor)
			.replace(/^place ?[:\-—]? ?/i, '')
			.trim();
		// The prompt asks for `Nth place: "item" — commentary`, so when the item is quoted, the
		// closing quote is the real boundary. Splitting on the first spaced dash instead would
		// truncate an item that contains one — `"Long distance - no calls"` became
		// `Long distance`, silently changing what the user submitted.
		const quoted = readQuotedPrefix(body);
		const rest = (
			quoted ??
			// Unquoted: fall back to cutting the commentary at the dash the prompt asks for.
			trimQuotes(body.split(/ [–—-] /)[0].trim())
		).trim();
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
/**
 * A title the spec contract will accept.
 *
 * `MeechieToolOutputSchema` accepts any non-empty headline, but `TitleSchema` does not: it rejects
 * the prompt assembler's reserved control lines, structural separators, and anything over the
 * length cap. A provider headline of `STYLE:` would therefore pass `/api/tools` and then be
 * refused by `/api/generate` as `GENERATE_INPUT_INVALID` — after the user had asked for the page.
 *
 * This asks `TitleSchema` itself instead of re-stating its rules. The first version of this guard
 * kept its own copy of the reserved list and was missing three of the contract's ten entries;
 * deferring to the schema cannot drift from it, and covers every other reason a title is refused.
 */
const toPageTitle = (parts: string[]): string => {
	const title = compactColoringPageTitle(parts);
	// `TitleSchema` accepts any non-empty, non-reserved line, so an emoji-only verdict survives
	// normalization as the single character "-" and passes. That is a valid title and a useless
	// page, so require at least one letter or digit before accepting it.
	if (/[A-Za-z0-9]/.test(title) && TitleSchema.safeParse(title).success) return title;
	const fallback = compactColoringPageTitle([]);
	return TitleSchema.safeParse(fallback).success ? fallback : 'Meechie Said It';
};

const buildTitle = (output: MeechieToolOutput, forList: boolean): string => {
	// A list page prints its payload as the items, so the title stays as the headline alone and
	// does not repeat the first beat.
	if (forList) return toPageTitle([output.headline]);

	// The score leads a `rate_excuse` page, but it is still a quote page and gets the same
	// whole-sentence treatment as the rest — a score-prefixed title used to skip the logic below
	// and could end mid-sentence on `Then he changed the`.
	const lead =
		output.toolId === 'rate_excuse' && typeof output.rating === 'number'
			? `${output.rating}/10`
			: output.headline;

	// A quote page has no items: the title is the whole printed page, and the spec contract caps
	// it at 96 characters. The prompts ask for one to three sentences, so a response that does not
	// fit is normal rather than exceptional, and a hard cut at 96 leaves the page ending
	// mid-sentence. Prefer the largest run of *whole* sentences that fits, so the page always
	// prints a finished thought. The remainder is not lost: the verdict card shows the full
	// response, Copy yields all of it, and a saved page stores it as `studioText.quote`.
	const wholeTitle = toPageTitle([lead, output.response]);
	const fits = (candidate: string): boolean =>
		compactColoringPageTitle([candidate]).length <= MAX_TITLE_LENGTH &&
		candidate.length <= MAX_TITLE_LENGTH;
	if (fits(`${lead} - ${output.response}`)) return wholeTitle;

	const sentences = splitResponseLines(output.response);
	// Two passes, and the order matters. Keeping the lead is worth more than keeping an extra
	// sentence — dropping it would take the score off a `rate_excuse` page, which is the whole
	// point of that page — so try every length *with* the lead before trying any without it.
	for (let take = sentences.length; take > 0; take -= 1) {
		const candidate = sentences.slice(0, take).join(' ');
		if (fits(`${lead} - ${candidate}`)) return toPageTitle([lead, candidate]);
	}
	for (let take = sentences.length; take > 0; take -= 1) {
		const candidate = sentences.slice(0, take).join(' ');
		if (fits(candidate)) return toPageTitle([candidate]);
	}
	// Not even the first sentence fits; fall back to the shared compaction, which cuts on a word
	// boundary rather than mid-word.
	return wholeTitle;
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

	const extractCandidateLines = (): string[] => {
		if (presentation.listSource === 'beats') return extractVerdictBeats(output.response);
		if (presentation.listSource === 'ranked') return extractRankedEntries(output.response);
		return [];
	};
	const items = toItems(extractCandidateLines());
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

/** The two-item floor `MeechieStudioTextOutputSchema` puts on `pageItems`. */
const MIN_STUDIO_PAGE_ITEMS = 2;

/**
 * Build the studio text to store alongside a page saved from the toolkit.
 *
 * This exists because omitting it is actively harmful, not merely lossy. `loadCreation` runs a
 * record without `studioText` through `buildStudioTextFromCreationRecord`, which falls back to
 * `assembledPrompt` for the quote — on a generated page that field holds the full image-generation
 * prompt, so reopening would print rendering instructions inside quotation marks as if Meechie had
 * said them — and, when the saved spec has no items (every full-quote page), falls back to
 * `DEFAULT_STUDIO_TEXT_OUTPUT.pageItems`, attaching the unrelated default landlord lines to the
 * user's own saved page.
 *
 * Every field below is text Meechie actually produced. `pageItems` prefers the lines the page
 * really prints; a full-quote page prints none, so it falls back to the verdict's own words split
 * into printable lines rather than to anything invented.
 */
export const buildToolStudioText = (
	output: MeechieToolOutput,
	recipe: ToolPageRecipe
): MeechieStudioTextOutput | null => {
	const printed = recipe.spec.items.map((item) => ({ number: item.number, label: item.label }));
	// A list page already prints two or more of the verdict's own lines; reuse exactly those.
	// Otherwise chop the response itself into printable lines, and if it is too short to yield the
	// two the schema demands, lead with the headline — still her words, never a placeholder.
	let items = printed.length >= MIN_STUDIO_PAGE_ITEMS ? printed : [];
	// Each fallback is still the verdict's own words; the page title is included because
	// `toPageTitle` guarantees it is printable even when the verdict is not.
	for (const source of [
		() => toItems(splitResponseLines(output.response)),
		() => toItems([output.headline, output.response]),
		() => toItems([recipe.spec.title, output.response])
	]) {
		if (items.length >= MIN_STUDIO_PAGE_ITEMS) break;
		items = source();
	}

	const candidate = {
		verdict: output.headline,
		quote: output.response,
		pageTitle: recipe.spec.title,
		pageItems: items.slice(0, MAX_TOOL_PAGE_ITEMS),
		...(typeof output.rating === 'number' ? { rating: output.rating } : {}),
		qualityState: 'ready' as const
	};

	// Validate before handing it to the store. `MeechieToolOutputSchema` accepts a verdict with no
	// printable characters at all — an emoji-only response — and no fallback above can conjure the
	// two page items the studio-text schema demands from it. Returning null there costs a degraded
	// reopen for that one record; returning an invalid object would make `saveCreation` reject the
	// whole save with `CREATION_SCHEMA_MISMATCH` and lose the page the user just paid to generate.
	const parsed = MeechieStudioTextOutputSchema.safeParse(candidate);
	return parsed.success ? parsed.data : null;
};
