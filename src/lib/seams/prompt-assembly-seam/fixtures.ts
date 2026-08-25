// Purpose: Provide fixture data for PromptAssemblySeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import {
	PromptAssemblyInputSchema,
	PromptAssemblyResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/prompt-assembly/sample.json';
import faultJson from '../../../../fixtures/prompt-assembly/fault.json';
import titleOnlyJson from '../../../../fixtures/prompt-assembly/title-only.json';
import titleOnlyMarkerFaultJson from '../../../../fixtures/prompt-assembly/title-only-marker-fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: PromptAssemblyInputSchema,
	output: PromptAssemblyResultSchema
});

export const promptAssemblySampleFixture = fixtureSchema.parse(sampleJson);
export const promptAssemblyFaultFixture = fixtureSchema.parse(faultJson);
export const promptAssemblyTitleOnlyFixture =
	fixtureSchema.parse(titleOnlyJson);

// Deliberately violates the relationship between a title-only input and its
// otherwise schema-valid output. Boundary validation must reject it.
export const promptAssemblyTitleOnlyMarkerFaultFixture: unknown =
	titleOnlyMarkerFaultJson;
