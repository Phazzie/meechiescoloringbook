// Purpose: Fixture-backed mock for MeechieStudioTextSeam.
// Why: Keep AI text contract tests deterministic without provider calls.
// Info flow: Scenario -> fixture result -> contract consumer.
import { z } from 'zod';
import {
	MeechieStudioTextInputSchema,
	MeechieStudioTextResultSchema
} from '../../../contracts/meechie-studio-text.contract';
import { ScenarioSchema, type Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/meechie-studio-text/sample.json';
import fault from '../../../fixtures/meechie-studio-text/fault.json';
import type { MeechieStudioTextSeam } from '../../../contracts/meechie-studio-text.contract';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieStudioTextInputSchema,
	output: MeechieStudioTextResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createMeechieStudioTextMock = (scenario: Scenario): MeechieStudioTextSeam => ({
	respond: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
