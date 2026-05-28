// Purpose: Mock PromptCompilerSeam behavior using fixture scenarios.
// Why: Keep tests deterministic without live I/O; zero invented data.
// Info flow: tests -> mock -> fixtures.
import type { PromptCompilerInput, PromptCompilerSeam } from './contract';
import { compiledPromptFixture } from './fixtures';

export const createMockPromptCompilerSeam = (): PromptCompilerSeam => ({
  compile: async (_input: PromptCompilerInput) => compiledPromptFixture
});
