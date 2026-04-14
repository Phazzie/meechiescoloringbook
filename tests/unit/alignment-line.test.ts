// Purpose: Unit tests for formatAlignmentLine utility.
// Why: Ensure alignment text is correct for all spec branch combinations.
// Info flow: ColoringPageSpec variants -> formatAlignmentLine -> assertion on output string.
import { describe, expect, it } from 'vitest';
import { formatAlignmentLine } from '../../src/lib/utils/alignment-line';
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

const SPACING_CLAUSE = 'treat blank space as intentional; do not fill empty space.';

describe('formatAlignmentLine', () => {
	describe('title_only mode', () => {
		it('returns centered text with spacing clause when alignment is center', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				listMode: 'title_only',
				items: [],
				alignment: 'center'
			};
			expect(formatAlignmentLine(spec)).toBe(`text centered; ${SPACING_CLAUSE}`);
		});

		it('returns left-aligned text with spacing clause when alignment is left', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				listMode: 'title_only',
				items: [],
				alignment: 'left'
			};
			expect(formatAlignmentLine(spec)).toBe(`all text left-aligned; ${SPACING_CLAUSE}`);
		});
	});

	describe('list mode', () => {
		it('returns strict numbers + left-aligned text with spacing clause', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				listMode: 'list',
				alignment: 'left',
				numberAlignment: 'strict'
			};
			expect(formatAlignmentLine(spec)).toBe(
				`all numbers vertically aligned; all text left-aligned; ${SPACING_CLAUSE}`
			);
		});

		it('returns strict numbers + centered text with spacing clause', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				listMode: 'list',
				alignment: 'center',
				numberAlignment: 'strict'
			};
			expect(formatAlignmentLine(spec)).toBe(
				`all numbers vertically aligned; text centered; ${SPACING_CLAUSE}`
			);
		});

		it('returns loose numbers + left-aligned text with spacing clause', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				listMode: 'list',
				alignment: 'left',
				numberAlignment: 'loose'
			};
			expect(formatAlignmentLine(spec)).toBe(
				`numbers readable; all text left-aligned; ${SPACING_CLAUSE}`
			);
		});

		it('returns loose numbers + centered text with spacing clause', () => {
			const spec: ColoringPageSpec = {
				...baseSpec,
				listMode: 'list',
				alignment: 'center',
				numberAlignment: 'loose'
			};
			expect(formatAlignmentLine(spec)).toBe(
				`numbers readable; text centered; ${SPACING_CLAUSE}`
			);
		});
	});
});
