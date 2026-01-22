import type { PromptCompilerInput, PromptCompilerSeam } from './contract';

export const probePromptCompilerSeam = async (
  seam: PromptCompilerSeam,
  input: PromptCompilerInput
) => seam.compile(input);
