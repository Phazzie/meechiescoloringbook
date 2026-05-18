// Purpose: Provide fixture data for MeechieVoiceSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/meechie-voice/sample.json';
import faultJson from '../../../../fixtures/meechie-voice/fault.json';

export const meechieVoiceSampleFixture = sampleJson;
export const meechieVoiceFaultFixture = faultJson;
