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
import type { ColoringPageSpec } from '../../contracts/spec-validation.contract';

const baseSpec: ColoringPageSpec = {
	title: 'Test',
	items: [{ number: 1, label: 'Item one' }],
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: 'none',
	illustrations: 'none',
	shading: 'none',
	border: 'plain',
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
};

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
			expect(colorModeLine('grayscale')).toBe('Color: grayscale.');
		});

		it('returns color line', () => {
			expect(colorModeLine('color')).toBe('Color: color.');
		});

		it('returns black and white line for default', () => {
			expect(colorModeLine('black_and_white_only')).toBe('Color: black and white only.');
		});
	});

	describe('pageSizeLine', () => {
		it('returns A4 dimensions for A4', () => {
			expect(pageSizeLine('A4')).toBe('A4 8.27x11.69 portrait.');
		});

		it('returns US Letter dimensions for US_Letter', () => {
			expect(pageSizeLine('US_Letter')).toBe('US Letter 8.5x11 portrait.');
		});
	});

	describe('fontStyleLine', () => {
		it('returns font style string', () => {
			expect(fontStyleLine('rounded')).toBe('Font: rounded.');
			expect(fontStyleLine('block')).toBe('Font: block.');
			expect(fontStyleLine('hand')).toBe('Font: hand.');
		});
	});

	describe('textStrokeLine', () => {
		it('returns stroke width string', () => {
			expect(textStrokeLine(6)).toBe('Stroke: 6px.');
			expect(textStrokeLine(12)).toBe('Stroke: 12px.');
		});
	});

	describe('decorationLine', () => {
		it('returns minimal decoration line', () => {
			expect(decorationLine('minimal')).toBe('Decorations: minimal outline icons.');
		});

		it('returns dense decoration line', () => {
			expect(decorationLine('dense')).toBe('Decorations: dense outline icons.');
		});

		it('returns none decoration line for default', () => {
			expect(decorationLine('none')).toBe('Decorations: none.');
		});
	});

	describe('illustrationLine', () => {
		it('returns simple illustration line', () => {
			expect(illustrationLine('simple')).toBe('Illustrations: simple outlines.');
		});

		it('returns scene illustration line', () => {
			expect(illustrationLine('scene')).toBe('Illustrations: scene outlines.');
		});

		it('returns none illustration line for default', () => {
			expect(illustrationLine('none')).toBe('Illustrations: none.');
		});
	});

	describe('shadingLine', () => {
		it('returns hatch shading line', () => {
			expect(shadingLine('hatch')).toBe('Shading: hatch.');
		});

		it('returns stippling shading line', () => {
			expect(shadingLine('stippling')).toBe('Shading: stippling.');
		});

		it('returns none shading line for default', () => {
			expect(shadingLine('none')).toBe('Shading: none.');
		});
	});

	describe('borderLine', () => {
		it('returns decorative border line with thickness', () => {
			expect(borderLine('decorative', 8)).toBe('Border: decorative 8px.');
		});

		it('returns none border line', () => {
			expect(borderLine('none', 8)).toBe('Border: none.');
		});

		it('returns plain border line with thickness for default', () => {
			expect(borderLine('plain', 10)).toBe('Border: plain 10px.');
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
			const result = listLineForSpec(baseSpec);
			expect(result).toContain('List items: 1. Item one');
			expect(result).toContain('Gutter: normal');
		});

		it('returns "No list." for title_only mode', () => {
			const spec: ColoringPageSpec = { ...baseSpec, listMode: 'title_only', items: [] };
			expect(listLineForSpec(spec)).toBe('No list.');
		});
	});

	describe('negativeLinesForSpec', () => {
		it('includes "no color" and "no grayscale" for black_and_white_only', () => {
			const lines = negativeLinesForSpec(baseSpec);
			expect(lines).toContain('no color');
			expect(lines).toContain('no grayscale');
		});

		it('includes "no color" but not "no grayscale" for grayscale mode', () => {
			const spec: ColoringPageSpec = { ...baseSpec, colorMode: 'grayscale' };
			const lines = negativeLinesForSpec(spec);
			expect(lines).toContain('no color');
			expect(lines).not.toContain('no grayscale');
		});

		it('excludes "no color" for color mode', () => {
			const spec: ColoringPageSpec = { ...baseSpec, colorMode: 'color' };
			const lines = negativeLinesForSpec(spec);
			expect(lines).not.toContain('no color');
		});

		it('includes "no shading" when shading is none', () => {
			const lines = negativeLinesForSpec(baseSpec);
			expect(lines).toContain('no shading');
		});

		it('excludes "no shading" when shading is hatch', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				shading: 'hatch',
				decorations: 'minimal'
			};
			const lines = negativeLinesForSpec(spec);
			expect(lines).not.toContain('no shading');
		});

		it('always includes universal negative phrases', () => {
			const lines = negativeLinesForSpec(baseSpec);
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
