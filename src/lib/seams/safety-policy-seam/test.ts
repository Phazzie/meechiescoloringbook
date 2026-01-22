import { describe, expect, it } from 'vitest';
import {
  missingConstraintCompiledPromptFixture,
  safeCompiledPromptFixture,
  safeUserRequestFixture,
  unsafeUserRequestFixture
} from './fixtures';
import { createMockSafetyPolicySeam } from './mock';
import { validateSafetyPolicyResult } from './validators';

describe('SafetyPolicySeam mock contract', () => {
  it('accepts safe user requests', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateUserRequest(safeUserRequestFixture);
    expect(result).toEqual({ ok: true });
    expect(validateSafetyPolicyResult(result)).toEqual({ ok: true });
  });

  it('rejects unsafe user requests', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateUserRequest(unsafeUserRequestFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
  });

  it('enforces outline-only constraints', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateCompiledPrompt(missingConstraintCompiledPromptFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
  });

  it('accepts compiled prompts with constraints', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateCompiledPrompt(safeCompiledPromptFixture);
    expect(result).toEqual({ ok: true });
    expect(validateSafetyPolicyResult(result)).toEqual({ ok: true });
  });
});
