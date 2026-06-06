// Purpose: Probe real behavior for SafetyPolicySeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import type { SafetyPolicyGenerateInput, SafetyPolicySeam } from './contract';

export const probeSafetyPolicySeam = (
  seam: SafetyPolicySeam,
  input: PromptCompilerInput,
  compiled: CompiledPrompt,
  generateInput: SafetyPolicyGenerateInput
) => ({
  generate: seam.validateGenerateRequest(generateInput),
  request: seam.validateUserRequest(input),
  compiled: seam.validateCompiledPrompt(compiled)
});
