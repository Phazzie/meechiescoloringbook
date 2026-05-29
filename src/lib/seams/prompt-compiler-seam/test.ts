// Purpose: Contract tests for PromptCompilerSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail validation.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
  compiledPromptFixture,
  compiledPromptFaultFixture,
  promptCompilerInputFixture,
  promptCompilerInputFaultFixture
} from './fixtures';
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

  it('fault scenario returns the fault fixture', async () => {
    const seam = createMockPromptCompilerSeam('fault');
    const compiled = await seam.compile(promptCompilerInputFixture);

    expect(compiled).toEqual(compiledPromptFaultFixture);
  });

  it('validator rejects fault input (empty description, out-of-range glamLevel)', () => {
    expect(() => validatePromptCompilerInput(promptCompilerInputFaultFixture)).toThrow();
  });

  it('validator rejects fault compiled prompt (empty imagePrompt and negativePrompt)', () => {
    expect(() => validateCompiledPrompt(compiledPromptFaultFixture)).toThrow();
  });
});
