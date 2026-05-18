// Purpose: Fixture-backed mock for PromptAssemblySeam.
// Why: Ensure prompt assembly behavior is deterministic in tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	PromptAssemblyInputSchema,
	PromptAssemblyResultSchema
} from './contract';
import type { PromptAssemblySeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { promptAssemblySampleFixture, promptAssemblyFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: PromptAssemblyInputSchema,
	output: PromptAssemblyResultSchema
});

const sampleFixture = fixtureSchema.parse(promptAssemblySampleFixture);
const faultFixture = fixtureSchema.parse(promptAssemblyFaultFixture);

export const createPromptAssemblyMock = (scenario: Scenario): PromptAssemblySeam => ({
	assemble: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
