// Purpose: Prove every Meechie tool verdict turns into a spec the generate contract accepts.
// Why: The tools hub can now print pages. A recipe that builds an invalid spec would fail at the
//      API boundary with the generation already paid for, so validate against the real schema
//      rather than against a hand-written expectation of it.
// Info flow: Tool output fixtures -> buildToolPageRecipe -> ColoringPageSpecSchema assertions.
import { describe, expect, it } from 'vitest';
import {
	MAX_TOOL_PAGE_ITEMS,
	buildToolPageRecipe,
	buildToolStudioText,
	extractRankedEntries,
	extractVerdictBeats,
	splitResponseLines
} from '../../src/lib/core/tool-page-recipe';
import { MeechieToolIdSchema } from '../../src/lib/seams/meechie-tool-seam/contract';
import type { MeechieToolOutput } from '../../src/lib/seams/meechie-tool-seam/contract';
import {
	ColoringPageSpecSchema,
	MAX_LABEL_LENGTH,
	MAX_TITLE_LENGTH
} from '../../src/lib/seams/spec-validation-seam/contract';
import { MeechieStudioTextOutputSchema } from '../../contracts/meechie-studio-text.contract';
import {
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText,
	buildStudioTextFromCreationRecord
} from '../../src/lib/core/meechie-studio';

const output = (
	toolId: MeechieToolOutput['toolId'],
	response: string,
	extra: Partial<MeechieToolOutput> = {}
): MeechieToolOutput => ({
	toolId,
	headline: 'Verdict Delivered',
	response,
	...extra
});

describe('splitResponseLines', () => {
	it('splits on newlines when the response came back as lines', () => {
		expect(splitResponseLines('Fault: he lied.\n\nConsequence: no access.')).toEqual([
			'Fault: he lied.',
			'Consequence: no access.'
		]);
	});

	it('falls back to sentence splitting when the structure arrived in one paragraph', () => {
		expect(splitResponseLines('Fault: he lied. Consequence: no access.')).toEqual([
			'Fault: he lied.',
			'Consequence: no access.'
		]);
	});

	it('returns nothing for a blank response', () => {
		expect(splitResponseLines('   \n  \n')).toEqual([]);
	});
});

describe('extractVerdictBeats', () => {
	it('keeps the documented prefixes as part of the printed line', () => {
		const beats = extractVerdictBeats(
			'Fault: he had time.\nConsequence: he lost the key.\nMove: change the locks.'
		);
		expect(beats).toEqual([
			'Fault: he had time.',
			'Consequence: he lost the key.',
			'Move: change the locks.'
		]);
	});

	it('normalizes prefix casing so two providers print the same page', () => {
		expect(extractVerdictBeats('FAULT: he had time.\nmove: change the locks.')).toEqual([
			'Fault: he had time.',
			'Move: change the locks.'
		]);
	});

	it('ignores prose that carries no beat prefix', () => {
		expect(extractVerdictBeats('He had time to know better and used it badly.')).toEqual([]);
	});

	it('drops a prefix with nothing after it', () => {
		expect(extractVerdictBeats('Fault:\nConsequence: he lost the key.')).toEqual([
			'Consequence: he lost the key.'
		]);
	});
});

describe('extractRankedEntries', () => {
	it('keeps the ranked item and drops the trailing commentary', () => {
		const entries = extractRankedEntries(
			'1st place: "My phone died" — the location stayed live all night.\n' +
				'2nd place: "I was asleep" — he posted at 3am.'
		);
		expect(entries).toEqual(['My phone died', 'I was asleep']);
	});

	it('reads a plain numbered list with no commentary dash', () => {
		expect(extractRankedEntries('1. Traffic was bad\n2. Phone was on silent')).toEqual([
			'Traffic was bad',
			'Phone was on silent'
		]);
	});

	it('ignores unnumbered prose', () => {
		expect(extractRankedEntries('These excuses all failed for the same reason.')).toEqual([]);
	});
});

describe('buildToolPageRecipe', () => {
	it('builds a schema-valid spec for every tool in the contract', () => {
		for (const toolId of MeechieToolIdSchema.options) {
			const recipe = buildToolPageRecipe(
				output(toolId, 'He had time to know better and he used it badly.')
			);
			const parsed = ColoringPageSpecSchema.safeParse(recipe.spec);
			expect(parsed.success, `${toolId} produced an invalid spec`).toBe(true);
			expect(recipe.styleHint.length).toBeGreaterThan(0);
		}
	});

	it('gives every tool its own visual treatment rather than one shared hint', () => {
		const hints = MeechieToolIdSchema.options.map(
			(toolId) => buildToolPageRecipe(output(toolId, 'A line.')).styleHint
		);
		expect(new Set(hints).size).toBe(hints.length);
	});

	it('prints a structured verdict as a numbered list page', () => {
		const recipe = buildToolPageRecipe(
			output(
				'red_flag_or_run',
				'Fault: he lied.\nConsequence: he lost the key.\nMove: change the locks.'
			)
		);
		expect(recipe.spec.listMode).toBe('list');
		expect(recipe.spec.items.map((item) => item.label)).toEqual([
			'Fault: he lied.',
			'Consequence: he lost the key.',
			'Move: change the locks.'
		]);
		expect(recipe.spec.items.map((item) => item.number)).toEqual([1, 2, 3]);
		// The list carries the payload, so the title must not repeat the first beat.
		expect(recipe.spec.title).toBe('Verdict Delivered');
	});

	it('falls back to a full-quote page when the verdict came back unstructured', () => {
		const recipe = buildToolPageRecipe(
			output('wwmd', 'He had time to know better and he used it badly.')
		);
		expect(recipe.spec.listMode).toBe('title_only');
		expect(recipe.spec.items).toEqual([]);
		expect(recipe.spec.title).toContain('He had time');
	});

	it('does not print a one-beat verdict as a single-item list', () => {
		const recipe = buildToolPageRecipe(output('wwmd', 'Move: change the locks tonight.'));
		expect(recipe.spec.listMode).toBe('title_only');
		expect(recipe.spec.items).toEqual([]);
	});

	it('leads the rate_excuse page with the score', () => {
		const recipe = buildToolPageRecipe(
			output('rate_excuse', 'The location stayed live all night.', {
				headline: '2/10',
				rating: 2
			})
		);
		expect(recipe.spec.title.startsWith('2/10')).toBe(true);
	});

	it('caps a long lineup at the printable item count', () => {
		const response = Array.from(
			{ length: MAX_TOOL_PAGE_ITEMS + 4 },
			(_unused, index) => `${index + 1}. Excuse number ${index + 1}`
		).join('\n');
		const recipe = buildToolPageRecipe(output('lineup', response));
		expect(recipe.spec.items).toHaveLength(MAX_TOOL_PAGE_ITEMS);
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
	});

	it('keeps labels inside the contract length and character set', () => {
		const recipe = buildToolPageRecipe(
			output(
				'red_flag_or_run',
				'Fault: he told a story about the phone dying that ran far past the length any label is allowed to be.\n' +
					'Consequence: he lost the key, the parking spot, and the benefit of the doubt for good.'
			)
		);
		expect(recipe.spec.listMode).toBe('list');
		for (const item of recipe.spec.items) {
			expect(item.label.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
		}
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
	});

	it('strips characters the label contract rejects instead of failing validation', () => {
		const recipe = buildToolPageRecipe(
			output('red_flag_or_run', 'Fault: he said “nothing” 💅\nConsequence: no access — none')
		);
		expect(recipe.spec.listMode).toBe('list');
		for (const item of recipe.spec.items) {
			expect(item.label).not.toMatch(/[\u{1F485}“”—]/u);
		}
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
	});

	it('keeps the title inside the contract length for a long response', () => {
		const recipe = buildToolPageRecipe(output('clapback', 'word '.repeat(120)));
		expect(recipe.spec.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
	});

	it('carries a sanitized dedication and omits an empty one', () => {
		const withDedication = buildToolPageRecipe(output('caption_this', 'A line.'), {
			dedication: 'For Ray 💅'
		});
		expect(withDedication.spec.dedication).toBe('For Ray');

		const blank = buildToolPageRecipe(output('caption_this', 'A line.'), {
			dedication: '   💅   '
		});
		expect(blank.spec.dedication).toBeUndefined();
		expect(ColoringPageSpecSchema.safeParse(blank.spec).success).toBe(true);
	});

	it('gives a list page more room between lines than a quote page', () => {
		const list = buildToolPageRecipe(
			output('red_flag_or_run', 'Fault: he lied.\nConsequence: no access.')
		);
		const quote = buildToolPageRecipe(output('red_flag_or_run', 'He lied and lost access.'));
		expect(list.spec.listGutter).toBe('loose');
		expect(quote.spec.listGutter).toBe('normal');
	});
});

describe('label truncation reads as a finished line', () => {
	// A 40-character cut routinely lands on a joining word. A coloring page line that trails off
	// mid-thought reads as a bug, so the cut has to fall back to the last word that carries.
	const labelsFor = (response: string): string[] =>
		buildToolPageRecipe(output('red_flag_or_run', response)).spec.items.map(
			(item) => item.label
		);

	it('cuts the fragment a trailing coordinator opened', () => {
		expect(
			labelsFor(
				'Fault: he had time to answer and used it on someone else.\n' +
					'Consequence: he lost the spare key and the benefit of the doubt.'
			)
		).toEqual(['Fault: he had time to answer', 'Consequence: he lost the spare key']);
	});

	it('never ends a label on a joining word', () => {
		const labels = labelsFor(
			'Fault: he said the story changed again because of the\n' +
				'Consequence: she stopped answering the phone for the'
		);
		for (const label of labels) {
			const lastWord = label.split(' ').at(-1)?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
			expect(['and', 'the', 'of', 'to', 'for', 'because', 'with']).not.toContain(lastWord);
		}
	});

	it('leaves a label that already fits completely alone', () => {
		expect(labelsFor('Fault: he lied.\nConsequence: no access.')).toEqual([
			'Fault: he lied.',
			'Consequence: no access.'
		]);
	});
});

describe('parsing survives hostile provider output', () => {
	// SonarCloud flagged the ranked-line pattern for super-linear backtracking, and it was real:
	// the previous `[).:\s]+\s*` put two quantifiers that both match a space next to each other,
	// and on `"1st" + " ".repeat(n) + "\n"` — a run of whitespace followed by a character `.`
	// cannot match — it took 4.5s at n=2000 and did not terminate at n=10000.
	//
	// The defence is layered, and these tests cover both layers:
	//   1. `splitResponseLines` collapses whitespace in one linear pass, so the shape never
	//      reaches the pattern through the public entry point. This is the real guarantee.
	//   2. The pattern itself no longer has the ambiguity, so a direct call to an exported
	//      helper degrades gracefully instead of hanging.
	const budgetMs = 5000;

	it('collapses a hostile whitespace run before it reaches any pattern', () => {
		const started = Date.now();
		const recipe = buildToolPageRecipe(
			output(
				'lineup',
				`1st${' '.repeat(200000)}\n2nd place: he was asleep\n3rd place: traffic`
			)
		);
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
		expect(Date.now() - started).toBeLessThan(budgetMs);
	});

	it('does not hang when a ranked helper is called directly on the pathological shape', () => {
		const started = Date.now();
		// n=10000 did not terminate before the fix.
		expect(extractRankedEntries(`1st${' '.repeat(10000)}\n`)).toEqual([]);
		expect(Date.now() - started).toBeLessThan(budgetMs);
	});

	it('does not hang on a long punctuation run in a label', () => {
		const started = Date.now();
		const recipe = buildToolPageRecipe(
			output(
				'red_flag_or_run',
				`Fault: ${'-'.repeat(100000)}x\nConsequence: he lost the spare key.`
			)
		);
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
		expect(Date.now() - started).toBeLessThan(budgetMs);
	});

	it('still parses a ranked line that uses several spaces around the dash', () => {
		expect(
			extractRankedEntries('1st place:   "My phone died"   —   the location was live')
		).toEqual(['My phone died']);
	});
});

describe('buildToolStudioText keeps a saved page faithful when reopened', () => {
	// Omitting `studioText` is not neutral. `buildStudioTextFromCreationRecord` falls back to
	// `assembledPrompt` for the quote — the image-generation prompt on a generated page — and to
	// `DEFAULT_STUDIO_TEXT_OUTPUT.pageItems` when the saved spec has no items, which is every
	// full-quote page. These assert against the real schema and the real loader.
	const save = (toolId: MeechieToolOutput['toolId'], response: string, extra = {}) => {
		const out = output(toolId, response, extra);
		const recipe = buildToolPageRecipe(out);
		const studioText = buildToolStudioText(out, recipe);
		// Every case in this block supplies printable words, so a null here is itself a failure.
		expect(studioText, `no studio text for ${toolId} / "${response}"`).not.toBeNull();
		return { out, recipe, studioText: studioText! };
	};

	it('satisfies the studio text contract for every tool, list page and quote page alike', () => {
		for (const toolId of MeechieToolIdSchema.options) {
			for (const response of [
				'Fault: he lied.\nConsequence: he lost the key.\nMove: change the locks.',
				'1st place: "My phone died"\n2nd place: "I was asleep"',
				'He had time to know better and he used it badly.',
				'Run.'
			]) {
				const { studioText } = save(toolId, response);
				const parsed = MeechieStudioTextOutputSchema.safeParse(studioText);
				expect(parsed.success, `${toolId} / "${response}" produced invalid studio text`).toBe(
					true
				);
			}
		}
	});

	it('stores what Meechie said, not the image prompt', () => {
		const { studioText } = save('clapback', 'He lost access and the parking spot.');
		expect(studioText.quote).toBe('He lost access and the parking spot.');
		expect(studioText.verdict).toBe('Verdict Delivered');
	});

	it('never attaches the default landlord page items to a quote page', () => {
		const { studioText } = save('caption_this', 'Diamond nails and no explanations.');
		const labels = studioText.pageItems.map((item) => item.label.toUpperCase());
		for (const fabricated of DEFAULT_STUDIO_TEXT_OUTPUT.pageItems) {
			expect(labels).not.toContain(fabricated.label.toUpperCase());
		}
		expect(studioText.pageItems.length).toBeGreaterThanOrEqual(2);
	});

	it('reuses the lines a list page actually prints', () => {
		const { recipe, studioText } = save(
			'red_flag_or_run',
			'Fault: he lied.\nConsequence: he lost the key.\nMove: change the locks.'
		);
		expect(studioText.pageItems).toEqual(recipe.spec.items);
	});

	it('survives the real reopen path without inventing anything', () => {
		const { out, recipe, studioText } = save('caption_this', 'Diamond nails, no explanations.');
		const restored = buildStudioTextFromCreationRecord({
			id: 'creation-1',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: recipe.spec,
			// The value that used to leak into the quote when studioText was absent.
			assembledPrompt: 'STYLE: bold outline art\nTEXT (exact):\nNEGATIVE PROMPT: no color',
			studioText,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});
		expect(restored.quote).toBe(out.response);
		expect(restored.quote).not.toContain('NEGATIVE PROMPT');
		expect(restored.verdict).toBe(out.headline);
	});

	// The red proof for the two tests above: this is exactly what a toolkit save produced before
	// `buildToolStudioText` existed, and it is why omitting the field was not a neutral choice.
	it('shows the damage the omitted field caused', () => {
		const { recipe } = save('caption_this', 'Diamond nails, no explanations.');
		const withoutStudioText = buildStudioTextFromCreationRecord({
			id: 'creation-1',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: recipe.spec,
			assembledPrompt: 'STYLE: bold outline art\nTEXT (exact):\nNEGATIVE PROMPT: no color',
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});
		// The image prompt surfaced as Meechie's quote...
		expect(withoutStudioText.quote).toContain('NEGATIVE PROMPT');
		// ...and the default landlord lines were attached to the user's saved page.
		expect(withoutStudioText.pageItems).toEqual(DEFAULT_STUDIO_TEXT_OUTPUT.pageItems);
	});

	it('carries the rate_excuse score across a save', () => {
		const { studioText } = save('rate_excuse', 'The location stayed live.', {
			headline: '2/10',
			rating: 2
		});
		expect(studioText.rating).toBe(2);
	});
});

describe('a quote page prints a finished thought', () => {
	// The spec contract caps a title at 96 characters and a quote page has no items, so the title
	// is the whole printed page. A hard cut at 96 leaves it ending mid-sentence.
	it('keeps whole sentences rather than cutting the last one in half', () => {
		const recipe = buildToolPageRecipe(
			output(
				'clapback',
				'He watched from the cheap seats all season. Then he asked for a ticket to the box.'
			)
		);
		expect(recipe.spec.listMode).toBe('title_only');
		expect(recipe.spec.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
		// The first sentence survives intact instead of being cut partway through the second.
		expect(recipe.spec.title).toContain('cheap seats all season');
		expect(recipe.spec.title.endsWith('Then he asked for a ticket to')).toBe(false);
	});

	it('still fits the headline and response together when they are short enough', () => {
		const recipe = buildToolPageRecipe(output('caption_this', 'Diamond nails, no answers.'));
		expect(recipe.spec.title).toContain('Verdict Delivered');
		expect(recipe.spec.title).toContain('Diamond nails');
	});
});

describe('findings from the review rounds', () => {
	it('keeps a ranked item that contains its own dash', () => {
		// `1st place: "Long distance - no calls" — commentary`. Splitting at the first spaced dash
		// truncated this to "Long distance", silently changing what the user submitted.
		expect(
			extractRankedEntries(
				'1st place: "Long distance - no calls" — he called once in March.\n' +
					'2nd place: "I was asleep" — he posted at 3am.'
			)
		).toEqual(['Long distance - no calls', 'I was asleep']);
	});

	it('still cuts commentary from an unquoted ranked item', () => {
		expect(extractRankedEntries('1st place: My phone died — the location was live\n2. Asleep')).toEqual(
			['My phone died', 'Asleep']
		);
	});

	it('never emits a title the spec contract reserves', () => {
		// `MeechieToolOutputSchema` accepts any non-empty headline, but `TitleSchema` rejects a
		// reserved control line — so this would have passed /api/tools and then been refused by
		// /api/generate, after the user asked for the page.
		for (const reserved of ['STYLE:', 'style:', 'Negative Prompt:', 'LAYOUT:']) {
			const recipe = buildToolPageRecipe(
				output('red_flag_or_run', 'Fault: he lied.\nConsequence: he lost the key.', {
					headline: reserved
				})
			);
			const parsed = ColoringPageSpecSchema.safeParse(recipe.spec);
			expect(parsed.success, `headline "${reserved}" produced an invalid spec`).toBe(true);
		}
	});

	it('rebuilds a reopened quote page as a quote page, not a numbered list', () => {
		// `buildColoringPageSpecFromMeechieText` hardcoded `listMode: 'list'`, so changing any
		// setting on a reopened full-quote page silently converted it and spent the next
		// generation on the wrong layout.
		const out = output('caption_this', 'Diamond nails, no explanations.');
		const recipe = buildToolPageRecipe(out);
		expect(recipe.spec.listMode).toBe('title_only');

		const studioText = buildToolStudioText(out, recipe);
		expect(studioText).not.toBeNull();
		const rebuilt = buildColoringPageSpecFromMeechieText({
			output: studioText!,
			pageSize: recipe.spec.pageSize,
			border: recipe.spec.border,
			styleHint: recipe.styleHint,
			listMode: recipe.spec.listMode
		});
		expect(rebuilt.listMode).toBe('title_only');
		expect(rebuilt.items).toEqual([]);
		expect(rebuilt.footerItem).toBeUndefined();
		expect(ColoringPageSpecSchema.safeParse(rebuilt).success).toBe(true);
	});

	it('still rebuilds a studio page as a list page by default', () => {
		const rebuilt = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown'
		});
		expect(rebuilt.listMode).toBe('list');
		expect(rebuilt.items.length).toBeGreaterThan(0);
		expect(rebuilt.footerItem).toBeDefined();
	});
});

describe('titles and labels defer to the contract that rejects them', () => {
	// The first version of this guard kept its own copy of the reserved control lines and was
	// missing three of the contract's ten. Asking the schema cannot drift from it.
	const everyReservedLine = [
		'STYLE:',
		'TEXT (exact):',
		'Headline, render these exact words and nothing else:',
		'Second line, render these exact words and nothing else:',
		'End of the headline block. Do not draw any section label.',
		'TYPOGRAPHY:',
		'LAYOUT:',
		'DECORATIONS:',
		'OUTPUT:',
		'NEGATIVE PROMPT:'
	];

	it('never emits a spec the contract refuses, for any reserved headline', () => {
		for (const reserved of everyReservedLine) {
			for (const response of [
				'Fault: he lied.\nConsequence: he lost the key.',
				'He had time to know better.'
			]) {
				const recipe = buildToolPageRecipe(output('red_flag_or_run', response, {
					headline: reserved
				}));
				const parsed = ColoringPageSpecSchema.safeParse(recipe.spec);
				expect(parsed.success, `headline "${reserved}" produced an invalid spec`).toBe(true);
			}
		}
	});

	it('never emits an item the contract refuses, for any reserved beat', () => {
		for (const reserved of everyReservedLine) {
			const recipe = buildToolPageRecipe(
				output(
					'red_flag_or_run',
					`Fault: ${reserved}\nConsequence: he lost the key.\nMove: change the locks.`
				)
			);
			expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
		}
	});
});

describe('prose that merely starts with a prefix word is not a structured beat', () => {
	// A prefix only counts when it is followed by a colon. Without that, ordinary prose beginning
	// "Moving on..." or "Consequences follow." would be chopped into mangled labels and printed as
	// a numbered page instead of falling back to the quote page.
	it('does not treat prefix-shaped prose as beats', () => {
		expect(extractVerdictBeats('Moving on is healthy. Consequences follow.')).toEqual([]);
		const recipe = buildToolPageRecipe(
			output('wwmd', 'Moving on is healthy. Consequences follow.')
		);
		expect(recipe.spec.listMode).toBe('title_only');
	});

	it('still accepts a real beat with or without a space before the colon', () => {
		expect(extractVerdictBeats('Move: change the locks.\nFault : he had time.')).toEqual([
			'Move: change the locks.',
			'Fault: he had time.'
		]);
	});
});

describe('a verdict with no printable words cannot break the save', () => {
	// `MeechieToolOutputSchema` accepts any non-empty headline and response, including text that
	// sanitizes away entirely. Before this was handled, an emoji-only verdict produced zero page
	// items — and `MeechieStudioTextOutputSchema` demands two, so `saveCreation` would have
	// rejected the whole vault write with CREATION_SCHEMA_MISMATCH and lost the generated page.
	const emojiOnly = output('caption_this', '\u{1F485}\u{1F485}', { headline: '\u{1F485}' });

	it('still builds a page the generate contract accepts', () => {
		const recipe = buildToolPageRecipe(emojiOnly);
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
	});

	it('does not print a title made only of punctuation', () => {
		const recipe = buildToolPageRecipe(emojiOnly);
		// The old behaviour normalized the emoji to the single character "-", which `TitleSchema`
		// accepts and no reader can use.
		expect(recipe.spec.title).toMatch(/[A-Za-z0-9]/);
		expect(recipe.spec.title).not.toBe('-');
	});

	it('returns null rather than studio text the store would reject', () => {
		const recipe = buildToolPageRecipe(emojiOnly);
		expect(buildToolStudioText(emojiOnly, recipe)).toBeNull();
	});

	it('always returns either null or a contract-valid record', () => {
		for (const toolId of MeechieToolIdSchema.options) {
			for (const response of ['\u{1F485}', '...', 'He had time.', 'Run.', '\u{1F485} \u{1F485}']) {
				for (const headline of ['\u{1F485}', 'STYLE:', 'Verdict Delivered']) {
					const out = output(toolId, response, { headline });
					const studioText = buildToolStudioText(out, buildToolPageRecipe(out));
					if (studioText === null) continue;
					expect(
						MeechieStudioTextOutputSchema.safeParse(studioText).success,
						`${toolId} / "${headline}" / "${response}" produced invalid studio text`
					).toBe(true);
				}
			}
		}
	});
});

describe('findings from the review round on 9f4e503', () => {
	it('does not split a structured verdict at an abbreviation', () => {
		// `Fault: Dr. Smith lied.` was split after "Dr." by the sentence splitter, the middle
		// fragment was dropped, and the page printed `Fault: Dr.`
		expect(extractVerdictBeats('Fault: Dr. Smith lied. Consequence: no access.')).toEqual([
			'Fault: Dr. Smith lied.',
			'Consequence: no access.'
		]);
		const recipe = buildToolPageRecipe(
			output('red_flag_or_run', 'Fault: Dr. Smith lied. Consequence: no access.')
		);
		expect(recipe.spec.items.map((item) => item.label)).toEqual([
			'Fault: Dr. Smith lied.',
			'Consequence: no access.'
		]);
	});

	it('still splits a one-line verdict that uses several prefixes without newlines', () => {
		expect(
			extractVerdictBeats('Fault: he lied. Consequence: no key. Move: change the locks.')
		).toEqual(['Fault: he lied.', 'Consequence: no key.', 'Move: change the locks.']);
	});

	it('gives a rate_excuse title the same whole-sentence treatment as every other quote page', () => {
		const recipe = buildToolPageRecipe(
			output(
				'rate_excuse',
				'He said the alarm never went off that morning. Then he changed the story twice before lunch.',
				{ headline: '2/10', rating: 2 }
			)
		);
		expect(recipe.spec.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
		// The score still leads, and the page does not end mid-sentence.
		expect(recipe.spec.title.startsWith('2/10')).toBe(true);
		expect(recipe.spec.title.endsWith('Then he changed the')).toBe(false);
		expect(ColoringPageSpecSchema.safeParse(recipe.spec).success).toBe(true);
	});
});

describe('beats split only where a beat actually starts', () => {
	it('does not split at a prefix word occurring inside the prose', () => {
		// `receipt:` here is part of the sentence, not the start of a beat. Splitting on it
		// fragmented the verdict and relabelled the second half.
		expect(
			extractVerdictBeats('Fault: The receipt: proves he lied. Consequence: revoke access.')
		).toEqual(['Fault: The receipt: proves he lied.', 'Consequence: revoke access.']);
	});

	it('still splits real beats, and still survives abbreviations', () => {
		expect(
			extractVerdictBeats('Fault: he lied. Consequence: no key. Move: change the locks.')
		).toEqual(['Fault: he lied.', 'Consequence: no key.', 'Move: change the locks.']);
		expect(extractVerdictBeats('Fault: Dr. Smith lied. Consequence: no access.')).toEqual([
			'Fault: Dr. Smith lied.',
			'Consequence: no access.'
		]);
	});

	it('still splits beats given on their own lines', () => {
		expect(
			extractVerdictBeats('Fault: he lied.\nConsequence: no key.\nMove: change the locks.')
		).toEqual(['Fault: he lied.', 'Consequence: no key.', 'Move: change the locks.']);
	});
});

describe('sentence selection survives abbreviations', () => {
	it('does not treat an abbreviation as a whole sentence when trimming a quote title', () => {
		// A response over 96 characters gets trimmed to the largest run of whole sentences that
		// fits. Splitting after every `. ` made `Dr.` a sentence, so the longest run that fit was
		// `Dr.` alone and the page printed the title `Verdict Delivered - Dr.` — a finished-looking
		// page with none of the verdict on it.
		const long =
			'Dr. Reyes signed off on the inspection he never actually attended, and the report he ' +
			'filed says otherwise in writing.';
		const recipe = buildToolPageRecipe(output('red_flag_or_run', long));
		expect(recipe.spec.title).not.toMatch(/Dr\.$/);
		expect(recipe.spec.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
	});

	it('keeps an abbreviation attached to its sentence', () => {
		expect(splitResponseLines('Dr. Reyes lied. He filed it anyway.')).toEqual([
			'Dr. Reyes lied.',
			'He filed it anyway.'
		]);
		expect(splitResponseLines('He called at 9 p.m. She was already gone.')).toEqual([
			'He called at 9 p.m. She was already gone.'
		]);
		expect(splitResponseLines('J. Reyes signed it. The date is wrong.')).toEqual([
			'J. Reyes signed it.',
			'The date is wrong.'
		]);
	});

	it('still splits ordinary sentences', () => {
		expect(splitResponseLines('He lied. She left. The locks changed.')).toEqual([
			'He lied.',
			'She left.',
			'The locks changed.'
		]);
	});
});
