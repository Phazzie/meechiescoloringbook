// Purpose: Fixture-backed mock for SpecValidationSeam.
// Why: Provide deterministic validation outputs for contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	SpecValidationInputSchema,
	SpecValidationOutputSchema
} from './contract';
import type { SpecValidationSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { specValidationSampleFixture, specValidationFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: SpecValidationInputSchema,
	output: SpecValidationOutputSchema
});

const sampleFixture = fixtureSchema.parse(specValidationSampleFixture);
const faultFixture = fixtureSchema.parse(specValidationFaultFixture);

export const createSpecValidationMock = (scenario: Scenario): SpecValidationSeam => ({
	validate: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
