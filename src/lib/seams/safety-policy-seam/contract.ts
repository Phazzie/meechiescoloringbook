// Purpose: Define SafetyPolicySeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { ColoringPageSpec } from '../../../../contracts/spec-validation.contract';
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

export type SafetyPolicyGenerateInput = {
  spec: ColoringPageSpec;
  styleHint?: string;
};

export type SafetyPolicySeam = {
  validateGenerateRequest: (input: SafetyPolicyGenerateInput) => SafetyPolicyResult;
  validateUserRequest: (input: PromptCompilerInput) => SafetyPolicyResult;
  validateCompiledPrompt: (compiled: CompiledPrompt) => SafetyPolicyResult;
};
