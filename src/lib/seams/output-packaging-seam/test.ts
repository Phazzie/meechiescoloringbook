/*
 * Purpose: Contract and unit verification for OutputPackagingSeam.
 * Why: Ensure OutputPackagingSeam contract invariants hold across scenarios without Canvas/DOM binaries.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Sample returns ok: true with expected files; fault returns NO_IMAGES error envelope; viewBox aspect ratio correctly resolved.
 */
import { describe, expect, it } from 'vitest';
import { OutputPackagingInputSchema } from './contract';
import { outputPackagingSampleFixture, outputPackagingFaultFixture } from './fixtures';
import { createOutputPackagingMock } from './mock';
import { parseSvgSize } from '../../adapters/output-packaging-seam';

describe('OutputPackagingSeam contract (self-contained)', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createOutputPackagingMock('sample');
		const output = await mock.package(outputPackagingSampleFixture.input);
		expect(output).toEqual(outputPackagingSampleFixture.output);
		expect(output.ok).toBe(true);
		if (output.ok) {
			const filenames = output.value.files.map((f) => f.filename);
			expect(filenames).toContain('coloring-page-abc.pdf');
			expect(filenames).toContain('coloring-page-abc-square.png');
			expect(filenames).toContain('coloring-page-abc-chat.png');
		}
	});

	it('mock returns fault fixture output', async () => {
		const mock = createOutputPackagingMock('fault');
		const output = await mock.package(outputPackagingFaultFixture.input);
		expect(output).toEqual(outputPackagingFaultFixture.output);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('NO_IMAGES');
			expect(output.error.message).toBe('No images provided for packaging.');
		}
	});

	it('validates schema constraints on input', () => {
		const valid = OutputPackagingInputSchema.safeParse(outputPackagingSampleFixture.input);
		expect(valid.success).toBe(true);

		const missingBaseName = OutputPackagingInputSchema.safeParse({
			...outputPackagingSampleFixture.input,
			fileBaseName: ''
		});
		expect(missingBaseName.success).toBe(false);
	});

	it('computes 2:1 aspect ratio canvas bounds from SVG with only viewBox', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><path d="M0 0h1000v500H0z"/></svg>';
		const size = parseSvgSize(svg);
		expect(size.width).toBe(1000);
		expect(size.height).toBe(500);
		expect(size.width / size.height).toBe(2);
	});
});
