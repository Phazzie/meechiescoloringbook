// Purpose: Provide fixture data for AuthContextSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/auth-context/sample.json';
import faultJson from '../../../../fixtures/auth-context/fault.json';

export const authContextSampleFixture = sampleJson;
export const authContextFaultFixture = faultJson;
