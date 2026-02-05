// Purpose: Fixture-backed mock for MeechieToolSeam.
// Why: Keep Meechie responses deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../../contracts/meechie-tool.contract';
import type { MeechieToolSeam } from '../../../contracts/meechie-tool.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/meechie-tool/sample.json';
import fault from '../../../fixtures/meechie-tool/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieToolInputSchema,
	output: MeechieToolResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createMeechieToolMock = (scenario: Scenario): MeechieToolSeam => ({
	respond: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
