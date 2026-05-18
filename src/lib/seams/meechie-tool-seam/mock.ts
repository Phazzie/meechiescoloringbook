// Purpose: Fixture-backed mock for MeechieToolSeam.
// Why: Keep Meechie responses deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from './contract';
import type { MeechieToolSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { meechieToolSampleFixture, meechieToolFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieToolInputSchema,
	output: MeechieToolResultSchema
});

const sampleFixture = fixtureSchema.parse(meechieToolSampleFixture);
const faultFixture = fixtureSchema.parse(meechieToolFaultFixture);

export const createMeechieToolMock = (scenario: Scenario): MeechieToolSeam => ({
	respond: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
