// Purpose: Provide fixture data for CreationStoreSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/creation-store/sample.json';
import faultJson from '../../../../fixtures/creation-store/fault.json';

export const creationStoreSampleFixture = sampleJson;
export const creationStoreFaultFixture = faultJson;
