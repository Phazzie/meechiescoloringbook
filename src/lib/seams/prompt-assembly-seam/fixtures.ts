// Purpose: Provide fixture data for PromptAssemblySeam.
// Why: Ensure deterministic mock and test inputs without live reads.
// Info flow: fixtures -> mocks/tests.
import sampleJson from '../../../../fixtures/prompt-assembly/sample.json';
import faultJson from '../../../../fixtures/prompt-assembly/fault.json';
import titleOnlyJson from '../../../../fixtures/prompt-assembly/title-only.json';

export const promptAssemblySampleFixture = sampleJson;
export const promptAssemblyFaultFixture = faultJson;
export const promptAssemblyTitleOnlyFixture = titleOnlyJson;
