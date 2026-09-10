// Purpose: Unit tests for prompt-template helper functions.
// Why: Ensure deterministic prompt line generation for all spec variants.
// Info flow: Spec field values -> template helpers -> assertion on output strings.
import { describe, expect, it } from 'vitest';
import {
	formatListItems,
	colorModeLine,
	pageSizeLine,
	fontStyleLine,
	textStrokeLine,
	letteringLine,
	whitespaceLine,
	MAX_PROMPTABLE_WHITESPACE,
	MIN_PROMPTABLE_WHITESPACE,
	decorationLine,
	illustrationLine,
	shadingLine,
	borderLine,
	outputLine,
	dedicationLine,
	listLineForSpec,
	negativeLinesForSpec,
	PROMPT_REQUIRED_HEADINGS,
	PROMPT_FORBIDDEN_TOKENS,
	RESERVED_STYLE_HINT_HEADINGS,
	NEGATIVE_PROMPT_HEADING,
	VECTOR_LINEWORK_PHRASE
} from '../../src/lib/core/prompt-template';
import { makeBaseSpec } from '../helpers/make-base-spec';
import { FontStyleSchema } from '../../src/lib/seams/spec-validation-seam/contract';

describe('prompt-template helpers', () => {
	describe('formatListItems', () => {
		it('formats a single item', () => {
			expect(formatListItems([{ number: 1, label: 'Apples' }])).toBe('1. Apples');
		});

		it('formats multiple items one per line with no separator punctuation', () => {
			const items = [
				{ number: 1, label: 'Apples' },
				{ number: 2, label: 'Bananas' },
				{ number: 3, label: 'Cherries' }
			];
			// This previously asserted '1. Apples; 2. Bananas; 3. Cherries'. Three live
			// generations showed the image model drawing that '; ' separator onto the page as
			// visible lettering, so the contract is now one item per line, nothing trailing.
			expect(formatListItems(items)).toBe('1. Apples\n2. Bananas\n3. Cherries');
			expect(formatListItems(items)).not.toContain(';');
		});

		it('handles empty array', () => {
			expect(formatListItems([])).toBe('');
		});
	});

	describe('colorModeLine', () => {
		it('returns grayscale line', () => {
			const line = colorModeLine('grayscale');
			expect(line).toContain('Color:');
			expect(line).toContain('grayscale');
		});

		it('returns color line', () => {
			const line = colorModeLine('color');
			expect(line).toContain('Color:');
			expect(line).toContain('color');
		});

		it('returns black and white line for default', () => {
			const line = colorModeLine('black_and_white_only');
			expect(line).toContain('Color:');
			expect(line).toContain('black and white');
		});
	});

	describe('pageSizeLine', () => {
		it('returns A4 dimensions for A4', () => {
			const line = pageSizeLine('A4');
			expect(line).toContain('A4');
			expect(line).toContain('8.27x11.69');
		});

		it('returns US Letter dimensions for US_Letter', () => {
			const line = pageSizeLine('US_Letter');
			expect(line).toContain('US Letter');
			expect(line).toContain('8.5x11');
		});
	});

	/*
	 * The letterform, which on this application's pages is the whole of the drawing — there is no
	 * spec field that can hold a subject, so `title`, `items` and `footerItem` are what gets drawn.
	 *
	 * This used to be `Font: ${fontStyle}.`: three bare enum tokens handed to an image model as art
	 * direction, `hand` among them, which is a variable name and not a letterform anyone draws. And
	 * the TYPOGRAPHY section contradicted it from the line above with the constant
	 * 'Bold bubble letters.' — on `block`, which is what all thirteen tool and mode pages build.
	 */
	describe('fontStyleLine', () => {
		it('describes a letterform rather than naming the enum value', () => {
			expect(fontStyleLine('rounded')).toBe(
				'Font: rounded bubble letters with soft, even curves.'
			);
			expect(fontStyleLine('block')).toBe(
				'Font: upright block letters, straight-sided and squared off.'
			);
			expect(fontStyleLine('hand')).toBe('Font: casual handwritten letters, uneven and flowing.');
		});

		// A test that only checked each line was non-empty would pass against three copies of one
		// sentence, which is exactly the state the field was in when a constant overruled it.
		it('gives every letterform a distinct instruction', () => {
			const lines = FontStyleSchema.options.map((value) => fontStyleLine(value));
			expect(new Set(lines).size).toBe(lines.length);
			for (const line of lines) {
				expect(line.trim().length).toBeGreaterThan(0);
			}
		});

		/*
		 * One field, one instruction — the rule reviews of PR #350 and PR #352 each earned once.
		 * How heavy the linework is belongs to `textStrokeLine` and how much of the sheet the words
		 * cover belongs to `whitespaceLine`, and both are emitted on the same physical line as this
		 * one. `letteringLine` owns letter *size*, so this must not claim that either.
		 */
		it('claims nothing that another line in the same prompt already sets', () => {
			for (const value of FontStyleSchema.options) {
				const line = fontStyleLine(value).toLowerCase();
				for (const claim of [
					'thick',
					'thin',
					'heavy',
					'weight',
					'outline',
					'stroke',
					'blank',
					'sheet',
					'filling',
					'large',
					'small',
					'%',
					// Letter *case* is the TEXT block's, not this line's. 'Font: upright block capitals'
					// contradicted "render these exact words and nothing else" for any title that was
					// not already uppercase — which `/describe` routinely sends. Review of PR #354.
					'capital',
					'uppercase',
					'lowercase',
					'all caps'
				]) {
					expect(line).not.toContain(claim);
				}
			}
		});

		it('carries no forbidden token', () => {
			for (const value of FontStyleSchema.options) {
				const lowered = fontStyleLine(value).toLowerCase();
				for (const token of PROMPT_FORBIDDEN_TOKENS) {
					expect(lowered).not.toContain(token);
				}
			}
		});
	});

	describe('decorationLine', () => {
		it('returns minimal decoration line', () => {
			expect(decorationLine('minimal')).toContain('minimal');
		});

		it('returns dense decoration line', () => {
			expect(decorationLine('dense')).toContain('dense');
		});

		it('returns none decoration line for default', () => {
			expect(decorationLine('none')).toContain('none');
		});
	});

	describe('illustrationLine', () => {
		it('returns simple illustration line', () => {
			expect(illustrationLine('simple')).toContain('simple');
		});

		it('returns scene illustration line', () => {
			expect(illustrationLine('scene')).toContain('scene');
		});

		it('returns none illustration line for default', () => {
			expect(illustrationLine('none')).toContain('none');
		});
	});

	describe('shadingLine', () => {
		it('returns hatch shading line', () => {
			expect(shadingLine('hatch')).toContain('hatch');
		});

		it('returns stippling shading line', () => {
			expect(shadingLine('stippling')).toContain('stippling');
		});

		it('returns none shading line for default', () => {
			expect(shadingLine('none')).toContain('none');
		});
	});

	describe('borderLine', () => {
		it('returns decorative border line with thickness', () => {
			const line = borderLine('decorative', 8);
			expect(line).toContain('decorative');
			expect(line).toContain('8');
		});

		it('returns none border line', () => {
			expect(borderLine('none', 8)).toContain('none');
		});

		it('returns plain border line with thickness for default', () => {
			const line = borderLine('plain', 10);
			expect(line).toContain('plain');
			expect(line).toContain('10');
		});
	});

	describe('outputLine', () => {
		it('returns grayscale output line', () => {
			const line = outputLine('grayscale');
			expect(line).toContain(VECTOR_LINEWORK_PHRASE);
			expect(line).toContain('Grayscale outlines on white');
		});

		it('returns color output line', () => {
			const line = outputLine('color');
			expect(line).toContain(VECTOR_LINEWORK_PHRASE);
			expect(line).toContain('Colored outlines on white');
		});

		it('returns black and white output line for default', () => {
			const line = outputLine('black_and_white_only');
			expect(line).toContain(VECTOR_LINEWORK_PHRASE);
			expect(line).toContain('Black outlines on white');
		});
	});

	describe('dedicationLine', () => {
		it('returns dedication string when provided', () => {
			expect(dedicationLine('Mom')).toBe('Add dedication: "Dedicated to Mom".');
		});

		it('returns empty string when undefined', () => {
			expect(dedicationLine(undefined)).toBe('');
		});
	});

	describe('listLineForSpec', () => {
		it('returns list items block with gutter for list mode', () => {
			const result = listLineForSpec(makeBaseSpec());
			expect(result.split('\n')).toContain('1. Item one');
			expect(result).toContain('Gutter: normal');
		});

		it('puts every item on its own line with no separator punctuation', () => {
			const spec = makeBaseSpec({
				items: [
					{ number: 1, label: 'Item one' },
					{ number: 2, label: 'Item two' },
					{ number: 3, label: 'Item three' }
				]
			});
			const lines = listLineForSpec(spec).split('\n');
			expect(lines.slice(1)).toEqual([
				'1. Item one',
				'2. Item two',
				'3. Item three'
			]);
			expect(lines.some((line) => line.includes(';'))).toBe(false);
		});

		it('returns "No list." for title_only mode', () => {
			const spec = makeBaseSpec({ listMode: 'title_only', items: [] });
			expect(listLineForSpec(spec)).toBe('No list.');
		});
	});

	describe('negativeLinesForSpec', () => {
		it('includes "no color" and "no grayscale" for black_and_white_only', () => {
			const lines = negativeLinesForSpec(makeBaseSpec());
			expect(lines).toContain('no color');
			expect(lines).toContain('no grayscale');
		});

		it('includes "no color" but not "no grayscale" for grayscale mode', () => {
			const spec = makeBaseSpec({ colorMode: 'grayscale' });
			const lines = negativeLinesForSpec(spec);
			expect(lines).toContain('no color');
			expect(lines).not.toContain('no grayscale');
		});

		it('excludes "no color" for color mode', () => {
			const spec = makeBaseSpec({ colorMode: 'color' });
			const lines = negativeLinesForSpec(spec);
			expect(lines).not.toContain('no color');
		});

		it('includes "no shading" when shading is none', () => {
			const lines = negativeLinesForSpec(makeBaseSpec());
			expect(lines).toContain('no shading');
		});

		it('excludes "no shading" when shading is hatch', () => {
			const spec = makeBaseSpec({ shading: 'hatch', decorations: 'minimal' });
			const lines = negativeLinesForSpec(spec);
			expect(lines).not.toContain('no shading');
		});

		it('always includes universal negative phrases', () => {
			const lines = negativeLinesForSpec(makeBaseSpec());
			expect(lines).toContain('no gradients');
			expect(lines).toContain('no filled shapes');
			expect(lines).toContain('no extra words');
		});
	});

	describe('letteringLine', () => {
		it('says something different for every text size', () => {
			const lines = (['small', 'medium', 'large'] as const).map(letteringLine);
			expect(new Set(lines).size).toBe(3);
		});

		it('names the size the spec asked for', () => {
			expect(letteringLine('small')).toContain('small');
			expect(letteringLine('medium')).toContain('medium');
			expect(letteringLine('large')).toContain('large');
		});

		// How much of the sheet is covered is `whitespaceScale`'s answer. Two lines in one prompt
		// each claiming to set page occupancy force the model to pick one and ignore the other.
		it('makes no claim about how much of the sheet is covered', () => {
			for (const size of ['small', 'medium', 'large'] as const) {
				const line = letteringLine(size).toLowerCase();
				for (const claim of ['sheet', 'page', 'room to colour', 'blank', 'filling', '%']) {
					expect(line).not.toContain(claim);
				}
			}
		});

		// `PROMPT_FORBIDDEN_TOKENS` contains `size:`, and the drift check reports any line carrying
		// one. A line called "Text size:" would have made every page in the app report a forbidden
		// token, which is why this one is called "Lettering".
		it('carries no forbidden token', () => {
			for (const size of ['small', 'medium', 'large'] as const) {
				const lowered = letteringLine(size).toLowerCase();
				for (const token of PROMPT_FORBIDDEN_TOKENS) {
					expect(lowered).not.toContain(token);
				}
			}
		});
	});

	/*
	 * Line weight — how thick the outlines are, and the one property that decides whether a printed
	 * page can be coloured inside at all.
	 *
	 * The defect these pin: `textStrokeLine` used to be `Stroke: ${n}px.` and nothing else, the only
	 * bare number in the whole prompt, emitted four lines under a TYPOGRAPHY constant that demanded
	 * "thick outlines" whatever that number said.
	 */
	describe('textStrokeLine', () => {
		it('says something different for every weight the contract allows', () => {
			const lines = [];
			for (let width = 4; width <= 12; width += 1) {
				lines.push(textStrokeLine(width));
			}
			expect(new Set(lines).size).toBe(lines.length);
		});

		// Was the whole of this seam's stroke coverage: `toContain('6px')` and `toContain('12px')`.
		// Kept, widened to the contract's full range, and joined by the assertions below.
		/*
		 * A proportion of the page, not a pixel count — and this assertion is the second version of
		 * itself. The first read `toContain(`${width}px`)` against a line that said
		 * "about Npx wide on a 1024px sheet", naming `DEFAULT_IMAGE_SIZE` as the reference. A review
		 * of PR #352 established that reference was never true: the xAI adapter's request body
		 * serializes only `model`, `prompt`, `n` and `response_format`, so the requested size never
		 * reaches the provider and the prompt was asserting a raster width nothing had asked for.
		 *
		 * A ratio needs no such promise. It holds at whatever size the provider returns, which is
		 * exactly the property a pixel figure did not have.
		 */
		it('states the width as a proportion of the page, not as a raster measurement', () => {
			expect(textStrokeLine(4)).toContain('0.4% of the page width');
			expect(textStrokeLine(12)).toContain('1.2% of the page width');
			for (let width = 4; width <= 12; width += 1) {
				expect(textStrokeLine(width)).not.toContain('px');
				expect(textStrokeLine(width)).not.toContain('sheet');
			}
		});

		/*
		 * One decimal, because the contract's whole range lands between 0.4% and 1.2%. Whole
		 * percentages would collapse 4, 5 and 6 onto "1%" — the field would stop reaching the picture
		 * at the thin end, which is the defect this run exists to fix, reintroduced by rounding.
		 */
		it('keeps every weight in the range distinguishable', () => {
			const lines = [];
			for (let width = 4; width <= 12; width += 1) {
				lines.push(textStrokeLine(width));
			}
			expect(new Set(lines).size).toBe(lines.length);
		});

		// Words, not only a number, because the words are the part an image model can follow. A
		// thinner spec must not describe itself in heavier terms than a thicker one.
		it('names the weight in words, and orders them with the number', () => {
			expect(textStrokeLine(4)).toContain('fine');
			expect(textStrokeLine(6)).toContain('medium-weight');
			expect(textStrokeLine(9)).toContain('bold');
			expect(textStrokeLine(12)).toContain('very thick');
		});

		/*
		 * One field, one instruction — the rule a review of PR #350 earned when `letteringLine`
		 * claimed page occupancy that `whitespaceScale` already owned. Letterform shape is
		 * `fontStyleLine`'s, letterform size is `letteringLine`'s, and how much of the sheet is
		 * covered is `whitespaceLine`'s. This line speaks only about the weight of the linework.
		 */
		it('claims nothing that another line in the same prompt already sets', () => {
			for (let width = 4; width <= 12; width += 1) {
				const line = textStrokeLine(width).toLowerCase();
				// '%' is deliberately not on this list, though it was until this line started
				// expressing itself as a proportion. The percent sign is not the claim —
				// `whitespaceLine` owns "% of the *sheet* left *blank*", which is page occupancy, and
				// this owns "% of the page *width*", which is stroke weight. The words below are what
				// separate them, so those are what this asserts.
				for (const claim of ['blank', 'filling', 'sheet', 'font', 'rounded', 'block', 'hand']) {
					expect(line).not.toContain(claim);
				}
			}
		});

		it('carries no forbidden token', () => {
			for (let width = 4; width <= 12; width += 1) {
				const lowered = textStrokeLine(width).toLowerCase();
				for (const token of PROMPT_FORBIDDEN_TOKENS) {
					expect(lowered).not.toContain(token);
				}
			}
		});
	});

	describe('whitespaceLine', () => {
		it('states the scale the spec asked for', () => {
			expect(whitespaceLine(35)).toContain('35%');
			expect(whitespaceLine(50)).toContain('50%');
		});

		// Every page in this app draws an exact headline, so "leave 100% of the sheet blank" and
		// "leave 0% blank" each contradict the TEXT block in the same prompt. Contradictory
		// instructions do not fail — they make the model pick one and ignore the other, on a
		// generation the reader has paid for. The encoder saturates instead.
		it('clamps the ends the contract allows but a page cannot carry', () => {
			expect(whitespaceLine(100)).toContain(`${MAX_PROMPTABLE_WHITESPACE}%`);
			expect(whitespaceLine(100)).not.toContain('100%');
			expect(whitespaceLine(0)).toContain(`${MIN_PROMPTABLE_WHITESPACE}%`);
			expect(whitespaceLine(0)).not.toContain(' 0%');
			// Saturating means two different extreme specs ask for the same thing, deliberately.
			expect(whitespaceLine(95)).toBe(whitespaceLine(100));
		});

		it('leaves every value inside the band alone', () => {
			for (let value = MIN_PROMPTABLE_WHITESPACE; value <= MAX_PROMPTABLE_WHITESPACE; value += 1) {
				expect(whitespaceLine(value)).toContain(`${value}%`);
			}
		});

		// The contract admits any number in range, and a prompt reading "about 47.5%" invites an
		// image model to draw the figure onto a sheet somebody colours in.
		it('rounds a fractional scale to a whole percentage', () => {
			expect(whitespaceLine(47.5)).toContain('48%');
			expect(whitespaceLine(47.4)).toContain('47%');
			// The sentence ends on a full stop, so "contains no dot" is the wrong assertion. What
			// must not appear is a decimal fraction before the percent sign.
			expect(whitespaceLine(47.5)).not.toMatch(/\d\.\d/);
		});

		it('says something different for different scales', () => {
			expect(whitespaceLine(35)).not.toBe(whitespaceLine(45));
		});

		it('carries no forbidden token', () => {
			const lowered = whitespaceLine(50).toLowerCase();
			for (const token of PROMPT_FORBIDDEN_TOKENS) {
				expect(lowered).not.toContain(token);
			}
		});
	});

	describe('exported constants', () => {
		it('PROMPT_REQUIRED_HEADINGS contains expected sections', () => {
			expect(PROMPT_REQUIRED_HEADINGS).toContain('STYLE:');
			expect(PROMPT_REQUIRED_HEADINGS).toContain('TEXT (exact):');
			expect(PROMPT_REQUIRED_HEADINGS).toContain('OUTPUT:');
			expect(PROMPT_REQUIRED_HEADINGS).toContain(NEGATIVE_PROMPT_HEADING);
		});

		it('PROMPT_FORBIDDEN_TOKENS contains known forbidden entries', () => {
			expect(PROMPT_FORBIDDEN_TOKENS).toContain('size:');
			expect(PROMPT_FORBIDDEN_TOKENS).toContain('quality:');
			expect(PROMPT_FORBIDDEN_TOKENS).toContain('style:');
		});

		it('RESERVED_STYLE_HINT_HEADINGS includes NEGATIVE_PROMPT_HEADING', () => {
			expect(RESERVED_STYLE_HINT_HEADINGS).toContain(NEGATIVE_PROMPT_HEADING);
		});
	});
});
