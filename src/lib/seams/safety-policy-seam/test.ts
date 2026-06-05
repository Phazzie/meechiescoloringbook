// Purpose: Contract tests for SafetyPolicySeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
  missingConstraintCompiledPromptFixture,
  safeCompiledPromptFixture,
  safeGenerateRequestFixture,
  safeUserRequestFixture,
  unsafeGenerateDedicationFixture,
  unsafeGenerateFooterFixture,
  unsafeGenerateItemFixture,
  unsafeGenerateStyleHintFixture,
  unsafeGenerateTitleFixture,
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

  it('accepts safe generate requests with optional footer and dedication omitted', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateGenerateRequest(safeGenerateRequestFixture);
    expect(result).toEqual({ ok: true });
    expect(validateSafetyPolicyResult(result)).toEqual({ ok: true });
  });

  it('rejects unsafe generate request titles with actionable details', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateGenerateRequest(unsafeGenerateTitleFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
    if (!result.ok) {
      expect(result.error.details).toContain('Field: title');
    }
  });

  it('rejects unsafe generate request item labels with actionable details', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateGenerateRequest(unsafeGenerateItemFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
    if (!result.ok) {
      expect(result.error.details).toContain('Field: item #1');
    }
  });

  it('rejects unsafe generate request footer labels with actionable details', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateGenerateRequest(unsafeGenerateFooterFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
    if (!result.ok) {
      expect(result.error.details).toContain('Field: footerItem');
    }
  });

  it('rejects unsafe generate request dedications with actionable details', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateGenerateRequest(unsafeGenerateDedicationFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
    if (!result.ok) {
      expect(result.error.details).toContain('Field: dedication');
    }
  });

  it('rejects unsafe generate request style hints with actionable details', () => {
    const seam = createMockSafetyPolicySeam();
    const result = seam.validateGenerateRequest(unsafeGenerateStyleHintFixture);
    expect(result.ok).toBe(false);
    expect(validateSafetyPolicyResult(result)).toEqual(result);
    if (!result.ok) {
      expect(result.error.details).toContain('Field: styleHint');
    }
  });
});
