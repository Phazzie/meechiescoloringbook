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

describe('prompt-template helpers', () => {
	describe('formatListItems', () => {
		it('formats a single item', () => {
			expect(formatListItems([{ number: 1, label: 'Apples' }])).toBe('1. Apples');
		});

		it('formats multiple items separated by semicolons', () => {
			const items = [
				{ number: 1, label: 'Apples' },
				{ number: 2, label: 'Bananas' },
				{ number: 3, label: 'Cherries' }
			];
			expect(formatListItems(items)).toBe('1. Apples; 2. Bananas; 3. Cherries');
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

	describe('fontStyleLine', () => {
		it('returns font style string', () => {
			expect(fontStyleLine('rounded')).toContain('rounded');
			expect(fontStyleLine('block')).toContain('block');
			expect(fontStyleLine('hand')).toContain('hand');
		});
	});

	describe('textStrokeLine', () => {
		it('returns stroke width string', () => {
			expect(textStrokeLine(6)).toContain('6px');
			expect(textStrokeLine(12)).toContain('12px');
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
		it('returns list items line with gutter for list mode', () => {
			const result = listLineForSpec(makeBaseSpec());
			expect(result).toContain('List items: 1. Item one');
			expect(result).toContain('Gutter: normal');
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
