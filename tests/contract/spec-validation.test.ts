// Purpose: Contract tests for SpecValidationSeam using fixture-backed mocks.
// Why: Ensure fixture inputs/outputs align with the contract before adapters.
// Info flow: Fixtures -> mock -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	SpecValidationInputSchema,
	SpecValidationOutputSchema
} from '../../contracts/spec-validation.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createSpecValidationMock } from '../../src/lib/mocks/spec-validation.mock';
import { specValidationAdapter } from '../../src/lib/adapters/spec-validation.adapter';
import sample from '../../fixtures/spec-validation/sample.json';
import fault from '../../fixtures/spec-validation/fault.json';
import titleOnly from '../../fixtures/spec-validation/title-only.json';
import maxItems from '../../fixtures/spec-validation/max-items.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: SpecValidationInputSchema,
	output: SpecValidationOutputSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);
const titleOnlyFixture = fixtureSchema.parse(titleOnly);
const maxItemsFixture = fixtureSchema.parse(maxItems);

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
