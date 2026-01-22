import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import { compiledPromptFixture, promptCompilerInputFixture } from '../prompt-compiler-seam/fixtures';

export const safeUserRequestFixture: PromptCompilerInput = {
  ...promptCompilerInputFixture
};

export const unsafeUserRequestFixture: PromptCompilerInput = {
  ...promptCompilerInputFixture,
  description: 'explicit sexual content'
};

export const safeCompiledPromptFixture: CompiledPrompt = {
  ...compiledPromptFixture
};

export const missingConstraintCompiledPromptFixture: CompiledPrompt = {
  ...compiledPromptFixture,
  imagePrompt: 'A scene without required constraints.'
};
