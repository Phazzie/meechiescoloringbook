// Purpose: Provide fixture data for SpecValidationSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { SpecValidationInputSchema, SpecValidationOutputSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from './sample.json';
import faultJson from './fault.json';
import titleOnlyJson from './title-only.json';
import maxItemsJson from './max-items.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: SpecValidationInputSchema,
	output: SpecValidationOutputSchema
});

export const specValidationSampleFixture = fixtureSchema.parse(sampleJson);
export const specValidationFaultFixture = fixtureSchema.parse(faultJson);
export const specValidationTitleOnlyFixture = fixtureSchema.parse(titleOnlyJson);
export const specValidationMaxItemsFixture = fixtureSchema.parse(maxItemsJson);
