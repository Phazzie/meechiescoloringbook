// Purpose: Contract tests for PromptCompilerSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { compiledPromptFixture, promptCompilerInputFixture } from './fixtures';
import { createMockPromptCompilerSeam } from './mock';
import { validateCompiledPrompt, validatePromptCompilerInput } from './validators';

describe('PromptCompilerSeam mock contract', () => {
  it('compiles a deterministic prompt and validates output', async () => {
    const seam = createMockPromptCompilerSeam();
    const input = validatePromptCompilerInput(promptCompilerInputFixture);
    const compiled = await seam.compile(input);

    expect(compiled).toEqual(compiledPromptFixture);
    expect(validateCompiledPrompt(compiled)).toEqual(compiledPromptFixture);
  });
});
