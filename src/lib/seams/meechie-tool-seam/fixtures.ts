// Purpose: Provide fixture data for MeechieToolSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/meechie-tool/sample.json';
import faultJson from '../../../../fixtures/meechie-tool/fault.json';

export const meechieToolSampleFixture = sampleJson;
export const meechieToolFaultFixture = faultJson;
