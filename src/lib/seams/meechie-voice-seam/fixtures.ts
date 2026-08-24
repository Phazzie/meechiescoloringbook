// Purpose: Provide fixture data for MeechieVoiceSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { MeechieVoiceInputSchema, MeechieVoiceResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/meechie-voice/sample.json';
import faultJson from '../../../../fixtures/meechie-voice/fault.json';
import malformedPackJson from '../../../../fixtures/meechie-voice/malformed-pack.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieVoiceInputSchema,
	output: MeechieVoiceResultSchema
});

export const meechieVoiceSampleFixture = fixtureSchema.parse(sampleJson);
export const meechieVoiceFaultFixture = fixtureSchema.parse(faultJson);

// Deliberately contract-violating: a pack that is well-formed everywhere except
// its quotes, which still carry the retired pre-migration shape. It is exported
// raw and NOT run through fixtureSchema, because parsing it here is exactly what
// must fail. Red-proof consumers assert the rejection instead.
export const meechieVoiceMalformedPackFixture: unknown = malformedPackJson;
