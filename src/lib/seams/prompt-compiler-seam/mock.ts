// Purpose: Mock PromptCompilerSeam behavior using fixture scenarios.
// Why: Keep tests deterministic without live I/O; zero invented data.
// Info flow: tests -> mock -> fixtures.
import type { PromptCompilerInput, PromptCompilerSeam } from './contract';
import { getCompiledPromptFixture } from './fixtures';

export const createMockPromptCompilerSeam = (scenario: 'sample' | 'fault' = 'sample'): PromptCompilerSeam => ({
  compile: async (_input: PromptCompilerInput) => getCompiledPromptFixture(scenario)
});
