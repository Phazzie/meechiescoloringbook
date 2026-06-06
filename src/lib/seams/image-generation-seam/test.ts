// Purpose: Contract tests for ImageGenerationSeam (mock and adapter).
// Why: Enforce mock adherence to the seam contract, prove fault fixture fails before mocking,
//      and verify the live adapter handles HTTP success, failure, and validation errors.
// Info flow: tests -> mock/adapter -> contract assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageGenerationRequestFixture, imageGenerationFaultFixture } from './fixtures';
import { createMockImageGenerationSeam } from './mock';
import {
  validateImageGenerationRequest,
  validateImageGenerationResult
} from './validators';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import type { ImageProviderConfigSeam } from '$lib/seams/image-provider-config-seam/contract';

const mockConfigSeam: ImageProviderConfigSeam = {
  getConfig: () => ({
    xaiApiKey: 'test-key',
    xaiImageModel: 'grok-imaging-image',
    xaiBaseUrl: 'https://api.x.ai/v1',
    xaiImageEndpointPath: '/images/generations'
  })
};

// xAI wire format — the shape the xAI /v1/images/generations endpoint returns.
const xaiSampleResponse = {
  data: [
    {
      url: 'https://example.com/image.png',
      b64_json: null,
      revised_prompt: 'a test image'
    }
  ]
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(xaiSampleResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
});

describe('ImageGenerationSeam adapter', () => {
  it('returns IMAGE_HTTP_ERROR when xAI responds with an HTTP failure', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('rate limited', {
        status: 429,
        statusText: 'Too Many Requests'
      })
    );
    const seam = createImageGenerationSeam(mockConfigSeam);
    const output = await seam.generate(imageGenerationRequestFixture);

    expect(output.ok).toBe(false);
    if (!output.ok) {
      expect(output.error.code).toBe('IMAGE_HTTP_ERROR');
      if (output.error.code === 'IMAGE_HTTP_ERROR') {
        expect(output.error.details?.status).toBe('429');
      }
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns an ok Result with images from a successful xAI response', async () => {
    const seam = createImageGenerationSeam(mockConfigSeam);
    const output = await seam.generate(imageGenerationRequestFixture);

    expect(output.ok).toBe(true);
    if (output.ok) {
      expect(output.value.images).toHaveLength(1);
      expect(output.value.images[0].url).toBe('https://example.com/image.png');
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns IMAGE_VALIDATION_ERROR for an invalid request without calling fetch', async () => {
    const seam = createImageGenerationSeam(mockConfigSeam);
    const output = await seam.generate({
      ...imageGenerationRequestFixture,
      prompt: ''
    });

    expect(output.ok).toBe(false);
    if (!output.ok) {
      expect(output.error.code).toBe('IMAGE_VALIDATION_ERROR');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
