// Purpose: Mock PromptAssemblySeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { PromptAssemblySeam } from './contract';
import { getPromptAssemblyFixture } from './fixtures';

export const createPromptAssemblyMock = (scenario: 'sample' | 'fault' = 'sample'): PromptAssemblySeam => ({
	assemble: async () => getPromptAssemblyFixture(scenario).output
});
