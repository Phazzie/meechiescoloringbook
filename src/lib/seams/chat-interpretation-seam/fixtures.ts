// Purpose: Provide fixture data for ChatInterpretationSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/chat-interpretation/sample.json';
import faultJson from '../../../../fixtures/chat-interpretation/fault.json';

export const chatInterpretationSampleFixture = sampleJson;
export const chatInterpretationFaultFixture = faultJson;
