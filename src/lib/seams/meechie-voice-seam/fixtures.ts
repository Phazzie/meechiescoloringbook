// Purpose: Provide fixture data for MeechieVoiceSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { MeechieVoiceInputSchema, MeechieVoiceResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/meechie-voice/sample.json';
import faultJson from '../../../../fixtures/meechie-voice/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieVoiceInputSchema,
	output: MeechieVoiceResultSchema
});

export const meechieVoiceSampleFixture = fixtureSchema.parse(sampleJson);
export const meechieVoiceFaultFixture = fixtureSchema.parse(faultJson);
