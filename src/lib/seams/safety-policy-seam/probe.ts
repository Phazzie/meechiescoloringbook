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
