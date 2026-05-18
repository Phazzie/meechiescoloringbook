// Purpose: Fixture-backed mock for MeechieVoiceSeam.
// Why: Keep Meechie voice packs deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	MeechieVoiceInputSchema,
	MeechieVoiceResultSchema
} from './contract';
import type { MeechieVoiceSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { meechieVoiceSampleFixture, meechieVoiceFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieVoiceInputSchema,
	output: MeechieVoiceResultSchema
});

const sampleFixture = fixtureSchema.parse(meechieVoiceSampleFixture);
const faultFixture = fixtureSchema.parse(meechieVoiceFaultFixture);

export const createMeechieVoiceMock = (scenario: Scenario): MeechieVoiceSeam => ({
	getVoicePack: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
