// Purpose: Probe real behavior for PromptCompilerSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { PromptCompilerInput, PromptCompilerSeam } from './contract';

export const probePromptCompilerSeam = async (
  seam: PromptCompilerSeam,
  input: PromptCompilerInput
) => seam.compile(input);
