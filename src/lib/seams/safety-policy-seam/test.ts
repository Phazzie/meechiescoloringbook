// Purpose: Contract tests for SafetyPolicySeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
  missingConstraintCompiledPromptFixture,
  safeCompiledPromptFixture,
  safeSpecFixture,
  safeUserRequestFixture,
  unsafeSpecFixture,
  unsafeSpecItemFixture,
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

  it('validateSpec accepts a spec with no disallowed keywords', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateSpec(safeSpecFixture);
    expect(result).toEqual({ ok: true });
    expect(validateSafetyPolicyResult(result)).toEqual({ ok: true });
  });

  it('validateSpec rejects a spec whose title contains a disallowed keyword', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateSpec(unsafeSpecFixture);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DISALLOWED_CONTENT');
    expect(validateSafetyPolicyResult(result)).toEqual(result);
  });

  it('validateSpec rejects a spec whose item label contains a disallowed keyword', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateSpec(unsafeSpecItemFixture);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DISALLOWED_CONTENT');
    expect(validateSafetyPolicyResult(result)).toEqual(result);
  });
});
