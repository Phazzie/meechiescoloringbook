import { describe, expect, it } from 'vitest';
import { imageGenerationRequestFixture } from './fixtures';
import { createMockImageGenerationSeam } from './mock';
import {
  validateImageGenerationRequest,
  validateImageGenerationResult
} from './validators';

describe('ImageGenerationSeam mock contract', () => {
  it('returns deterministic images', async () => {
    const seam = createMockImageGenerationSeam();
    const request = validateImageGenerationRequest(imageGenerationRequestFixture);
    const result = await seam.generate(request);

    expect(result.images).toHaveLength(2);
    expect(result.images[0]?.url).toMatch(/^data:image\/svg\+xml/);
    expect(validateImageGenerationResult({
      ...result,
      timingMs: Math.max(result.timingMs, 0)
    })).toEqual({
      ...result,
      timingMs: result.timingMs
    });
  });
});
