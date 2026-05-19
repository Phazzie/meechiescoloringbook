// Purpose: Provide fixture data for SpecValidationSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { SpecValidationInputSchema, SpecValidationOutputSchema } from './validators';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/spec-validation/sample.json';
import faultJson from '../../../../fixtures/spec-validation/fault.json';
import titleOnlyJson from '../../../../fixtures/spec-validation/title-only.json';
import maxItemsJson from '../../../../fixtures/spec-validation/max-items.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: SpecValidationInputSchema,
	output: SpecValidationOutputSchema
});

export const specValidationSampleFixture = fixtureSchema.parse(sampleJson);
export const specValidationFaultFixture = fixtureSchema.parse(faultJson);
export const specValidationTitleOnlyFixture = fixtureSchema.parse(titleOnlyJson);
export const specValidationMaxItemsFixture = fixtureSchema.parse(maxItemsJson);

export const getSpecValidationFixture = (scenario: 'sample' | 'fault' = 'sample') =>
	scenario === 'fault' ? specValidationFaultFixture : specValidationSampleFixture;
