/*
 * Purpose: Contract and unit verification for MeechieStudioTextSeam.
 * Why: Ensure MeechieStudioTextSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Sample returns ok: true with valid studio text; fault returns MEECHIE_STUDIO_TEXT_PROVIDER_INVALID; pageItems count strictly 2-6.
 */
import { describe, expect, it } from 'vitest';
import { MeechieStudioCurrentTextSchema, MeechieStudioTextOutputSchema } from './contract';
import { meechieStudioTextSampleFixture, meechieStudioTextFaultFixture } from './fixtures';
import { createMeechieStudioTextMock } from './mock';

describe('MeechieStudioTextSeam contract (self-contained)', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createMeechieStudioTextMock('sample');
		const output = await mock.respond(meechieStudioTextSampleFixture.input);
		expect(output).toEqual(meechieStudioTextSampleFixture.output);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.verdict).toBe('The phone did not die. The effort did.');
			expect(output.value.pageItems).toHaveLength(3);
		}
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMeechieStudioTextMock('fault');
		const output = await mock.respond(meechieStudioTextFaultFixture.input);
		expect(output).toEqual(meechieStudioTextFaultFixture.output);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('MEECHIE_STUDIO_TEXT_PROVIDER_INVALID');
			expect(output.error.message).toBe('Provider text response did not match contract.');
		}
	});

	it('validates pageItems array bounds (between 2 and 6 items)', () => {
		const sampleValue = meechieStudioTextSampleFixture.output.ok
			? meechieStudioTextSampleFixture.output.value
			: null;
		expect(sampleValue).not.toBeNull();
		if (!sampleValue) return;

		// 1 item should fail (< 2)
		const tooFew = MeechieStudioTextOutputSchema.safeParse({
			...sampleValue,
			pageItems: [{ number: 1, label: 'Single item' }]
		});
		expect(tooFew.success).toBe(false);

		// 7 items should fail (> 6)
		const tooMany = MeechieStudioTextOutputSchema.safeParse({
			...sampleValue,
			pageItems: [
				{ number: 1, label: 'One' },
				{ number: 2, label: 'Two' },
				{ number: 3, label: 'Three' },
				{ number: 4, label: 'Four' },
				{ number: 5, label: 'Five' },
				{ number: 6, label: 'Six' },
				{ number: 7, label: 'Seven' }
			]
		});
		expect(tooMany.success).toBe(false);

		// 3 items should succeed
		const valid = MeechieStudioTextOutputSchema.safeParse(sampleValue);
		expect(valid.success).toBe(true);

		// Check currentText pageItems bounds
		const currentTooFew = MeechieStudioCurrentTextSchema.safeParse({
			verdict: 'v',
			quote: 'q',
			pageTitle: 't',
			pageItems: ['only-one']
		});
		expect(currentTooFew.success).toBe(false);
	});
});
