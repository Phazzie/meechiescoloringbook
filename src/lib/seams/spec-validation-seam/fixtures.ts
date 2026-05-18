// Purpose: Provide fixture data for SpecValidationSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/spec-validation/sample.json';
import faultJson from '../../../../fixtures/spec-validation/fault.json';
import titleOnlyJson from '../../../../fixtures/spec-validation/title-only.json';
import maxItemsJson from '../../../../fixtures/spec-validation/max-items.json';

export const specValidationSampleFixture = sampleJson;
export const specValidationFaultFixture = faultJson;
export const specValidationTitleOnlyFixture = titleOnlyJson;
export const specValidationMaxItemsFixture = maxItemsJson;
