// Purpose: Mock PromptCompilerSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { PromptCompilerSeam } from './contract';
import { compiledPromptFixture } from './fixtures';

export const createMockPromptCompilerSeam = (): PromptCompilerSeam => ({
  compile: async () => compiledPromptFixture
});
