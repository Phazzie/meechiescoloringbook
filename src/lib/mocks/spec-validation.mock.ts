// Purpose: Fixture-backed mock for SpecValidationSeam.
// Why: Provide deterministic validation outputs for contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	SpecValidationInputSchema,
	SpecValidationOutputSchema
} from '../../../contracts/spec-validation.contract';
import type { SpecValidationSeam } from '../../../contracts/spec-validation.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/spec-validation/sample.json';
import fault from '../../../fixtures/spec-validation/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: SpecValidationInputSchema,
	output: SpecValidationOutputSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createSpecValidationMock = (scenario: Scenario): SpecValidationSeam => ({
	validate: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
