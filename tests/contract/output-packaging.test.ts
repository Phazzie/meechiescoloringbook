// Purpose: Contract tests for OutputPackagingSeam using fixture-backed mocks.
// Why: Ensure packaging behavior remains deterministic and validated.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	OutputPackagingInputSchema,
	OutputPackagingResultSchema
} from '../../contracts/output-packaging.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createOutputPackagingMock } from '../../src/lib/mocks/output-packaging.mock';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import sample from '../../fixtures/output-packaging/sample.json';
import fault from '../../fixtures/output-packaging/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: OutputPackagingInputSchema,
	output: OutputPackagingResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

describe('OutputPackagingSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createOutputPackagingMock('sample');
		const output = await mock.package(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createOutputPackagingMock('fault');
		const output = await mock.package(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns error for empty image list', async () => {
		const output = await outputPackagingAdapter.package(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter behavior is gated to browser for svg conversion', async () => {
		const output = await outputPackagingAdapter.package(sampleFixture.input);
		if (typeof document === 'undefined') {
			expect(output.ok).toBe(false);
			if (!output.ok) {
				expect(output.error.code).toBe('BROWSER_REQUIRED');
			}
		} else {
			expect(output.ok).toBe(true);
			if (output.ok) {
				const filenames = output.value.files.map((file) => file.filename);
				expect(filenames).toContain('coloring-page-abc.pdf');
				expect(filenames).toContain('coloring-page-abc-square.png');
				expect(filenames).toContain('coloring-page-abc-chat.png');
			}
		}
	});
});
