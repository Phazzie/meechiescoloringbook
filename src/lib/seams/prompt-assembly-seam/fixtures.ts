// Purpose: Provide fixture data for PromptAssemblySeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { PromptAssemblyInputSchema, PromptAssemblyResultSchema } from './validators';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/prompt-assembly/sample.json';
import faultJson from '../../../../fixtures/prompt-assembly/fault.json';
import titleOnlyJson from '../../../../fixtures/prompt-assembly/title-only.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: PromptAssemblyInputSchema,
	output: PromptAssemblyResultSchema
});

export const promptAssemblySampleFixture = fixtureSchema.parse(sampleJson);
export const promptAssemblyFaultFixture = fixtureSchema.parse(faultJson);
export const promptAssemblyTitleOnlyFixture = fixtureSchema.parse(titleOnlyJson);

export const getPromptAssemblyFixture = (scenario: 'sample' | 'fault' = 'sample') =>
	scenario === 'fault' ? promptAssemblyFaultFixture : promptAssemblySampleFixture;
