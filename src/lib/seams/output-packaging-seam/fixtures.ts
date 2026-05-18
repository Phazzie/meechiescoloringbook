// Purpose: Provide fixture data for OutputPackagingSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/output-packaging/sample.json';
import faultJson from '../../../../fixtures/output-packaging/fault.json';

export const outputPackagingSampleFixture = sampleJson;
export const outputPackagingFaultFixture = faultJson;
