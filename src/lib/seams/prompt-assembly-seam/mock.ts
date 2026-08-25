// Purpose: Mock PromptAssemblySeam behavior using fixtures.
// Why: Ensure prompt assembly behavior is deterministic in tests.
// Info flow: Scenario -> fixture output -> callers.
import type { PromptAssemblyResult, PromptAssemblySeam } from './contract';
import {
	promptAssemblySampleFixture,
	promptAssemblyFaultFixture,
	promptAssemblyTitleOnlyMarkerFaultFixture
} from './fixtures';

export const createPromptAssemblyMock = (scenario: 'sample' | 'fault' = 'sample'): PromptAssemblySeam => ({
	assemble: async () =>
		scenario === 'fault' ? promptAssemblyFaultFixture.output : promptAssemblySampleFixture.output
});

// Red-proof double: serve the checked-in semantic fault even though its output
// is structurally valid, so input/result boundary validation has to catch it.
export const createTitleOnlyMarkerFaultMock = (): PromptAssemblySeam => ({
	assemble: async () =>
		(promptAssemblyTitleOnlyMarkerFaultFixture as { output: PromptAssemblyResult }).output
});
