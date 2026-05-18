// Purpose: Provide fixture data for SessionSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/session/sample.json';
import faultJson from '../../../../fixtures/session/fault.json';

export const sessionSampleFixture = sampleJson;
export const sessionFaultFixture = faultJson;
