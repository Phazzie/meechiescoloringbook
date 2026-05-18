// Purpose: Fixture-backed mock for MeechieStudioTextSeam.
// Why: Keep AI text contract tests deterministic without provider calls.
// Info flow: Scenario -> fixture result -> contract consumer.
import { z } from 'zod';
import {
	MeechieStudioTextInputSchema,
	MeechieStudioTextResultSchema
} from './contract';
import { ScenarioSchema, type Scenario } from '../../../../contracts/shared.contract';
import type { MeechieStudioTextSeam } from './contract';
import { meechieStudioTextSampleFixture, meechieStudioTextFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieStudioTextInputSchema,
	output: MeechieStudioTextResultSchema
});

const sampleFixture = fixtureSchema.parse(meechieStudioTextSampleFixture);
const faultFixture = fixtureSchema.parse(meechieStudioTextFaultFixture);

export const createMeechieStudioTextMock = (scenario: Scenario): MeechieStudioTextSeam => ({
	respond: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
