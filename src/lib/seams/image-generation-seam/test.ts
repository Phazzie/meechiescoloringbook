// Purpose: Contract tests for ImageGenerationSeam.
// Why: Enforce mock adherence to the seam contract, and prove the fault fixture fails before mocking.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { imageGenerationRequestFixture, imageGenerationFaultFixture } from './fixtures';
import { createMockImageGenerationSeam } from './mock';
import {
  validateImageGenerationRequest,
  validateImageGenerationResult
} from './validators';
import { MAX_PROMPT_LENGTH } from '../../../../contracts/image-generation.contract';

describe('ImageGenerationSeam mock contract', () => {
  it('returns a Result with deterministic images on success', async () => {
    const seam = createMockImageGenerationSeam('sample');
    const request = validateImageGenerationRequest(imageGenerationRequestFixture);
    const result = await seam.generate(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.images).toHaveLength(2);
    expect(result.value.images[0]?.url).toMatch(/^data:image\/svg\+xml/);
    expect(validateImageGenerationResult({
      ...result.value,
      timingMs: Math.max(result.value.timingMs, 0)
    })).toEqual({
      ...result.value,
      timingMs: result.value.timingMs
    });
  });

  it('fault fixture returns a failing Result before mock changes', async () => {
    const seam = createMockImageGenerationSeam('fault');
    const request = validateImageGenerationRequest(imageGenerationRequestFixture);
    const result = await seam.generate(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe(imageGenerationFaultFixture.code);
    expect(result.error.message).toBe(imageGenerationFaultFixture.message);
  });

  it('accepts requests without a negativePrompt', async () => {
    const seam = createMockImageGenerationSeam('sample');
    const request = validateImageGenerationRequest({
      prompt: 'a simple coloring page',
      n: 1,
      size: '512x512',
      format: 'url'
    });
    const result = await seam.generate(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.images).toHaveLength(1);
  });

  it('rejects a prompt over MAX_PROMPT_LENGTH', () => {
    expect(() =>
      validateImageGenerationRequest({
        ...imageGenerationRequestFixture,
        prompt: 'a'.repeat(MAX_PROMPT_LENGTH + 1)
      })
    ).toThrow();
  });

  it('rejects a negativePrompt over MAX_PROMPT_LENGTH', () => {
    expect(() =>
      validateImageGenerationRequest({
        ...imageGenerationRequestFixture,
        negativePrompt: 'a'.repeat(MAX_PROMPT_LENGTH + 1)
      })
    ).toThrow();
  });

  it('accepts a negativePrompt at MAX_PROMPT_LENGTH', () => {
    expect(() =>
      validateImageGenerationRequest({
        ...imageGenerationRequestFixture,
        negativePrompt: 'a'.repeat(MAX_PROMPT_LENGTH)
      })
    ).not.toThrow();
  });
});
