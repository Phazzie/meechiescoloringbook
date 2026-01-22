import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import type { SafetyPolicyResult, SafetyPolicySeam } from './contract';

const disallowedKeywords = [
  'sexual',
  'nude',
  'explicit',
  'minors',
  'self-harm',
  'suicide',
  'extremist',
  'illegal'
];

const hasDisallowedContent = (text: string) =>
  disallowedKeywords.some((keyword) => text.toLowerCase().includes(keyword));

const requiresOutlineOnly = (compiled: CompiledPrompt): SafetyPolicyResult => {
  const prompt = compiled.imagePrompt.toLowerCase();
  if (!prompt.includes('outline-only')) {
    return {
      ok: false,
      error: {
        code: 'MISSING_OUTLINE_CONSTRAINT',
        message: 'Prompt must enforce outline-only line art.'
      }
    };
  }

  if (!prompt.includes('no color')) {
    return {
      ok: false,
      error: {
        code: 'MISSING_NO_COLOR_CONSTRAINT',
        message: 'Prompt must explicitly forbid color.'
      }
    };
  }

  return { ok: true };
};

export const createMockSafetyPolicySeam = (): SafetyPolicySeam => ({
  validateUserRequest: (input: PromptCompilerInput) => {
    if (hasDisallowedContent(input.description)) {
      return {
        ok: false,
        error: {
          code: 'DISALLOWED_CONTENT',
          message: 'Request contains disallowed content.',
          details: ['Remove sexual, self-harm, extremist, or illegal content.']
        }
      };
    }

    return { ok: true };
  },
  validateCompiledPrompt: (compiled: CompiledPrompt) => {
    if (hasDisallowedContent(compiled.imagePrompt)) {
      return {
        ok: false,
        error: {
          code: 'DISALLOWED_CONTENT',
          message: 'Compiled prompt contains disallowed content.'
        }
      };
    }

    return requiresOutlineOnly(compiled);
  }
});
