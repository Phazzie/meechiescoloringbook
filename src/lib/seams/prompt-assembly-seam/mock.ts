// Purpose: Mock PromptAssemblySeam behavior using fixtures.
// Why: Ensure prompt assembly behavior is deterministic in tests.
// Info flow: Scenario -> fixture output -> callers.
import type { PromptAssemblySeam } from './contract';
import { promptAssemblySampleFixture, promptAssemblyFaultFixture } from './fixtures';

export const createPromptAssemblyMock = (scenario: 'sample' | 'fault' = 'sample'): PromptAssemblySeam => ({
	assemble: async () =>
		scenario === 'fault' ? promptAssemblyFaultFixture.output : promptAssemblySampleFixture.output
});
