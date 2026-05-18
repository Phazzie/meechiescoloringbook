// Purpose: Provide fixture data for DriftDetectionSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/drift-detection/sample.json';
import faultJson from '../../../../fixtures/drift-detection/fault.json';
import titleOnlyJson from '../../../../fixtures/drift-detection/title-only.json';

export const driftDetectionSampleFixture = sampleJson;
export const driftDetectionFaultFixture = faultJson;
export const driftDetectionTitleOnlyFixture = titleOnlyJson;
