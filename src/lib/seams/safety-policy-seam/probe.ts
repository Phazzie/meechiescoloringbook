// Purpose: Probe real behavior for SafetyPolicySeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import type { SafetyPolicySeam } from './contract';

export const probeSafetyPolicySeam = (
  seam: SafetyPolicySeam,
  input: PromptCompilerInput,
  compiled: CompiledPrompt
) => ({
  request: seam.validateUserRequest(input),
  compiled: seam.validateCompiledPrompt(compiled)
});
