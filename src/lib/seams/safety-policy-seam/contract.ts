import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';

export type SafetyPolicyErrorCode =
  | 'DISALLOWED_CONTENT'
  | 'MISSING_OUTLINE_CONSTRAINT'
  | 'MISSING_NO_COLOR_CONSTRAINT';

export type SafetyPolicyError = {
  code: SafetyPolicyErrorCode;
  message: string;
  details?: string[];
};

export type SafetyPolicyResult =
  | { ok: true }
  | { ok: false; error: SafetyPolicyError };

export type SafetyPolicySeam = {
  validateUserRequest: (input: PromptCompilerInput) => SafetyPolicyResult;
  validateCompiledPrompt: (compiled: CompiledPrompt) => SafetyPolicyResult;
};
