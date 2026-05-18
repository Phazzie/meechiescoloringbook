// Purpose: Provide fixture data for ProviderAdapterSeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/provider-adapter/sample.json';
import faultJson from '../../../../fixtures/provider-adapter/fault.json';

export const providerAdapterSampleFixture = sampleJson;
export const providerAdapterFaultFixture = faultJson;
