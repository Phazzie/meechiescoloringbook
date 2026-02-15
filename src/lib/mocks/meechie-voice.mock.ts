// Purpose: Fixture-backed mock for MeechieVoiceSeam.
// Why: Keep Meechie voice packs deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	MeechieVoiceInputSchema,
	MeechieVoiceResultSchema
} from '../../../contracts/meechie-voice.contract';
import type { MeechieVoiceSeam } from '../../../contracts/meechie-voice.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/meechie-voice/sample.json';
import fault from '../../../fixtures/meechie-voice/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieVoiceInputSchema,
	output: MeechieVoiceResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createMeechieVoiceMock = (scenario: Scenario): MeechieVoiceSeam => ({
	getVoicePack: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
