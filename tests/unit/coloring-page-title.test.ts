// Purpose: Unit tests for compact coloring-page route titles.
// Why: Prevent long tool responses from exceeding provider prompt limits.
// Info flow: Raw route text -> compact title -> assertions.
import { describe, expect, it } from 'vitest';
import { promptAssemblyAdapter } from '../../src/lib/adapters/prompt-assembly.adapter';
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

	it('keeps rate-excuse coloring page prompts inside the image model limit', async () => {
		const title = compactColoringPageTitle([
			'2/10',
			'Traffic did not create a three-act play. Evidence pattern: story has no verifiable trail.'
		]);

		const assembled = await promptAssemblyAdapter.assemble({
			spec: {
				title,
				listMode: 'title_only',
				items: [],
				dedication: 'He had time to do better and chose plot holes',
				alignment: 'center',
				numberAlignment: 'strict',
				listGutter: 'normal',
				whitespaceScale: 30,
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
			},
			styleHint:
				'gavel, scales, diamonds, verdict stamp, bold statement coloring page'
		});

		expect(assembled.ok).toBe(true);
		if (assembled.ok) {
			expect(assembled.value.prompt).toContain('2/10');
			expect(assembled.value.prompt.length).toBeLessThan(8000);
		}
	});
});
