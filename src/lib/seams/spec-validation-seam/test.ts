// Purpose: Contract tests for SpecValidationSeam using fixture-backed mocks.
// Why: Ensure fixture inputs/outputs align with the contract before adapters.
// Info flow: Fixtures -> mock -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	SpecValidationInputSchema,
	SpecValidationOutputSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createSpecValidationMock } from './mock';
import { specValidationAdapter } from '../../adapters/spec-validation-seam';
import {
	specValidationSampleFixture,
	specValidationFaultFixture,
	specValidationTitleOnlyFixture,
	specValidationMaxItemsFixture
} from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: SpecValidationInputSchema,
	output: SpecValidationOutputSchema
});

const sampleFixture = fixtureSchema.parse(specValidationSampleFixture);
const faultFixture = fixtureSchema.parse(specValidationFaultFixture);
const titleOnlyFixture = fixtureSchema.parse(specValidationTitleOnlyFixture);
const maxItemsFixture = fixtureSchema.parse(specValidationMaxItemsFixture);

describe('SpecValidationSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createSpecValidationMock('sample');
		const output = await mock.validate(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createSpecValidationMock('fault');
		const output = await mock.validate(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await specValidationAdapter.validate(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await specValidationAdapter.validate(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await specValidationAdapter.validate(titleOnlyFixture.input);
		expect(output).toEqual(titleOnlyFixture.output);
	});

	it('adapter rejects specs with too many items', async () => {
		const output = await specValidationAdapter.validate(maxItemsFixture.input);
		expect(output).toEqual(maxItemsFixture.output);
	});
});
