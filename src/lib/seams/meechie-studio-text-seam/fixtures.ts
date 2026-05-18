// Purpose: Provide fixture data for MeechieStudioTextSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/meechie-studio-text/sample.json';
import faultJson from '../../../../fixtures/meechie-studio-text/fault.json';

export const meechieStudioTextSampleFixture = sampleJson;
export const meechieStudioTextFaultFixture = faultJson;
