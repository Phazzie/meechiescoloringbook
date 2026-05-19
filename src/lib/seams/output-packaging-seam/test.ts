// Purpose: Contract tests for OutputPackagingSeam.
// Why: Enforce mock and adapter adherence to the seam contract.
// Info flow: fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { outputPackagingSampleFixture, outputPackagingFaultFixture } from './fixtures';
import { createOutputPackagingMock } from './mock';
import { outputPackagingAdapter } from '../../adapters/output-packaging.adapter';

describe('OutputPackagingSeam mock contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createOutputPackagingMock('sample');
		const output = await mock.package(outputPackagingSampleFixture.input);
		expect(output).toEqual(outputPackagingSampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createOutputPackagingMock('fault');
		const output = await mock.package(outputPackagingFaultFixture.input);
		expect(output).toEqual(outputPackagingFaultFixture.output);
	});
});

describe('OutputPackagingSeam adapter contract', () => {
	const browserGateErrorCodes = new Set([
		'BROWSER_REQUIRED',
		'CANVAS_UNAVAILABLE',
		'SVG_IMAGE_LOAD_FAILED',
		'IMAGE_RESIZE_FAILED',
		'PNG_ENCODING_FAILED'
	]);

	it('adapter returns error for empty image list', async () => {
		const output = await outputPackagingAdapter.package(outputPackagingFaultFixture.input);
		expect(output).toEqual(outputPackagingFaultFixture.output);
	});

	it('adapter behavior is gated to browser for svg conversion', async () => {
		const output = await outputPackagingAdapter.package(outputPackagingSampleFixture.input);
		if (output.ok) {
			const filenames = output.value.files.map((file) => file.filename);
			expect(filenames).toContain('coloring-page-abc.pdf');
			expect(filenames).toContain('coloring-page-abc-square.png');
			expect(filenames).toContain('coloring-page-abc-chat.png');
			return;
		}
		expect(browserGateErrorCodes.has(output.error.code)).toBe(true);
	});
});
