// Purpose: Fixture-backed mock for PromptAssemblySeam.
// Why: Ensure prompt assembly behavior is deterministic in tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	PromptAssemblyInputSchema,
	PromptAssemblyResultSchema
} from '../../../contracts/prompt-assembly.contract';
import type { PromptAssemblySeam } from '../../../contracts/prompt-assembly.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/prompt-assembly/sample.json';
import fault from '../../../fixtures/prompt-assembly/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: PromptAssemblyInputSchema,
	output: PromptAssemblyResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createPromptAssemblyMock = (scenario: Scenario): PromptAssemblySeam => ({
	assemble: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
