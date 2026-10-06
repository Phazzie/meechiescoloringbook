// Purpose: Implement the deterministic SafetyPolicySeam guardrail.
// Why: Keep generate and prompt safety checks behind one pure seam implementation.
// Info flow: route/core seam call -> policy text scan -> SafetyPolicyResult.
import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import type {
  SafetyPolicyGenerateInput,
  SafetyPolicyResult,
  SafetyPolicySeam
} from './contract';
import { SYSTEM_CONSTANTS } from '../../core/constants';

type TextSegment = {
  field: string;
  text: unknown;
};

/**
 * The keywords this seam refuses — the shared constant itself, not a list derived from it.
 *
 * This used to be `[...SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS, 'suicide', 'extremist']`, a private
 * widening that made this seam refuse content `findDisallowedKeywords` — the check behind
 * /api/tools and /api/meechie-studio-text — waved through. A local addition to a policy two other
 * routes read through a different function is a silent split, not a stricter seam.
 *
 * Exported so `tests/unit/safety-keyword-parity.test.ts` can assert **identity** with the shared
 * constant rather than mere equality of contents. That is the assertion that catches the original
 * mistake mechanically: any spread, append or rebuild produces a different array and fails it,
 * where a contents comparison would pass for a copy that then drifts.
 */
export const enforcedDisallowedKeywords: readonly string[] = SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS;

const hasDisallowedContent = (text: string) =>
  enforcedDisallowedKeywords.some((keyword) => text.toLowerCase().includes(keyword));

const disallowedContent = (message: string, field: string): SafetyPolicyResult => ({
  ok: false,
  error: {
    code: 'DISALLOWED_CONTENT',
    message,
    details: [
      `Field: ${field}`,
      'Remove content involving minors, self-harm, suicide, or extremist material.'
    ]
  }
});

const firstDisallowedSegment = (segments: TextSegment[]) =>
  segments.find((segment) => typeof segment.text === 'string' && hasDisallowedContent(segment.text));

const generateRequestSegments = ({ spec, styleHint }: SafetyPolicyGenerateInput): TextSegment[] => [
  { field: 'title', text: spec.title },
  ...(Array.isArray(spec.items)
    ? spec.items.map((item, index) => ({ field: `item #${index + 1}`, text: item?.label }))
    : []),
  { field: 'footerItem', text: spec.footerItem?.label },
  { field: 'dedication', text: spec.dedication },
  { field: 'styleHint', text: styleHint }
];

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

export const createSafetyPolicySeam = (): SafetyPolicySeam => ({
  validateGenerateRequest: (input) => {
    const disallowed = firstDisallowedSegment(generateRequestSegments(input));
    if (disallowed) {
      return disallowedContent('Generate request contains disallowed content.', disallowed.field);
    }

    return { ok: true };
  },
  validateUserRequest: (input: PromptCompilerInput) => {
    const disallowed = firstDisallowedSegment([{ field: 'description', text: input.description }]);
    if (disallowed) {
      return disallowedContent('Request contains disallowed content.', disallowed.field);
    }

    return { ok: true };
  },
  validateCompiledPrompt: (compiled: CompiledPrompt) => {
    const disallowed = firstDisallowedSegment([
      { field: 'compiledPrompt', text: compiled.imagePrompt }
    ]);
    if (disallowed) {
      return disallowedContent('Compiled prompt contains disallowed content.', disallowed.field);
    }

    return requiresOutlineOnly(compiled);
  }
});
