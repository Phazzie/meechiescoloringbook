// Purpose: Unit tests for compact coloring-page route titles.
// Why: Prevent long tool responses from exceeding provider prompt limits.
// Info flow: Raw route text -> compact title -> assertions.
import { describe, expect, it } from 'vitest';
import { compactColoringPageTitle } from '../../src/lib/core/coloring-page-title';

describe('compactColoringPageTitle', () => {
	it('joins short title parts without changing useful text', () => {
		expect(
			compactColoringPageTitle(['2/10', 'Traffic did not do all that.'])
		).toBe('2/10 - Traffic did not do all that.');
	});

	it('limits long route responses before prompt assembly', () => {
		const title = compactColoringPageTitle([
			'Red flag',
			'Fault: them. Consequence: access gets reduced until facts improve. '.repeat(
				5
			)
		]);

		expect(title.length).toBeLessThanOrEqual(96);
		expect(title).not.toMatch(/[.,;:\-]$/);
	});

	it('falls back when all input text is empty', () => {
		expect(compactColoringPageTitle(['', '   '])).toBe('Meechie Said It');
	});
});
