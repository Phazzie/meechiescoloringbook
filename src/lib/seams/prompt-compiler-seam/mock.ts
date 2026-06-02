// Purpose: Mock PromptCompilerSeam behavior using fixture scenarios.
// Why: Keep tests deterministic without live I/O; zero invented data.
// Info flow: tests -> mock -> fixtures.
import type { CompiledPrompt, PromptCompilerSeam } from './contract';
import { compiledPromptFixture, compiledPromptFaultFixture } from './fixtures';

export const createMockPromptCompilerSeam = (scenario: 'sample' | 'fault' = 'sample'): PromptCompilerSeam => ({
  compile: async (_input) =>
    structuredClone(
      scenario === 'sample' ? compiledPromptFixture : (compiledPromptFaultFixture as unknown as CompiledPrompt)
    )
});
