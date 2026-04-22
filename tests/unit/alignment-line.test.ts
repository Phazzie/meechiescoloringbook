// Purpose: Unit tests for formatAlignmentLine utility.
// Why: Ensure alignment text is correct for all spec branch combinations.
// Info flow: ColoringPageSpec variants -> formatAlignmentLine -> assertion on output string.
import { describe, expect, it } from 'vitest';
import { formatAlignmentLine } from '../../src/lib/utils/alignment-line';
import { makeBaseSpec } from '../helpers/make-base-spec';

const SPACING_CLAUSE = 'treat blank space as intentional; do not fill empty space.';

describe('formatAlignmentLine', () => {
	describe('title_only mode', () => {
		it('returns centered text with spacing clause when alignment is center', () => {
			const spec = makeBaseSpec({ listMode: 'title_only', items: [], alignment: 'center' });
			const line = formatAlignmentLine(spec);
			expect(line).toContain('text centered');
			expect(line).toContain(SPACING_CLAUSE);
		});

		it('returns left-aligned text with spacing clause when alignment is left', () => {
			const spec = makeBaseSpec({ listMode: 'title_only', items: [], alignment: 'left' });
			const line = formatAlignmentLine(spec);
			expect(line).toContain('text left-aligned');
			expect(line).toContain(SPACING_CLAUSE);
		});
	});

	describe('list mode', () => {
		it('returns strict numbers + left-aligned text with spacing clause', () => {
			const spec = makeBaseSpec({ listMode: 'list', alignment: 'left', numberAlignment: 'strict' });
			const line = formatAlignmentLine(spec);
			expect(line).toContain('numbers vertically aligned');
			expect(line).toContain('text left-aligned');
			expect(line).toContain(SPACING_CLAUSE);
		});

		it('returns strict numbers + centered text with spacing clause', () => {
			const spec = makeBaseSpec({ listMode: 'list', alignment: 'center', numberAlignment: 'strict' });
			const line = formatAlignmentLine(spec);
			expect(line).toContain('numbers vertically aligned');
			expect(line).toContain('text centered');
			expect(line).toContain(SPACING_CLAUSE);
		});

		it('returns loose numbers + left-aligned text with spacing clause', () => {
			const spec = makeBaseSpec({ listMode: 'list', alignment: 'left', numberAlignment: 'loose' });
			const line = formatAlignmentLine(spec);
			expect(line).toContain('numbers readable');
			expect(line).toContain('text left-aligned');
			expect(line).toContain(SPACING_CLAUSE);
		});

		it('returns loose numbers + centered text with spacing clause', () => {
			const spec = makeBaseSpec({ listMode: 'list', alignment: 'center', numberAlignment: 'loose' });
			const line = formatAlignmentLine(spec);
			expect(line).toContain('numbers readable');
			expect(line).toContain('text centered');
			expect(line).toContain(SPACING_CLAUSE);
		});
	});
});
