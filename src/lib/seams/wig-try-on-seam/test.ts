// Purpose: Contract tests for WigTryOnSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail before mocking.
// Info flow: tests -> mock -> contract assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWigTryOnSeam } from '../../adapters/wig-try-on-seam';
import { IMAGE_MODEL, TEXT_MODEL } from '../../core/models';
import type { AppConfigSeam } from '../app-config-seam/contract';
import {
  wigTryOnRequestFixture,
  wigTryOnHttpErrorFixture,
  wigTryOnConfigErrorFixture
} from './fixtures';
import { createMockWigTryOnSeam } from './mock';
import { validateWigTryOnRequest, validateWigTryOnResult } from './validators';

const mockConfigSeam: AppConfigSeam = {
  getConfig: () => ({
    xaiApiKey: 'test-xai-key',
    xaiTextModel: TEXT_MODEL,
    xaiImageModel: IMAGE_MODEL,
    xaiBaseUrl: 'https://api.x.ai/v1',
    xaiImageEndpointPath: '/images/generations',
    featureIntegrationTests: false,
    maxImagesPerRequest: 4,
    defaultImageSize: '1024x1024',
    geminiApiKey: 'test-gemini-key',
    geminiBaseUrl: 'https://generativelanguage.googleapis.com'
  })
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WigTryOnSeam mock contract', () => {
  it('tryOn returns a portrait Result on success', async () => {
    const seam = createMockWigTryOnSeam('sample');
    const request = validateWigTryOnRequest(wigTryOnRequestFixture);
    const result = await seam.tryOn(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.portraitBase64.length).toBeGreaterThan(0);
    expect(() => validateWigTryOnResult(result.value)).not.toThrow();
  });

  it('http_error scenario returns WIG_TRY_ON_HTTP_ERROR', async () => {
    const seam = createMockWigTryOnSeam('http_error');
    const request = validateWigTryOnRequest(wigTryOnRequestFixture);
    const result = await seam.tryOn(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(wigTryOnHttpErrorFixture.code);
  });

  it('config_error scenario returns WIG_TRY_ON_CONFIG_ERROR', async () => {
    const seam = createMockWigTryOnSeam('config_error');
    const request = validateWigTryOnRequest(wigTryOnRequestFixture);
    const result = await seam.tryOn(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(wigTryOnConfigErrorFixture.code);
  });

  it('portrait base64 is a non-empty string', async () => {
    const seam = createMockWigTryOnSeam('sample');
    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value.portraitBase64).toBe('string');
    expect(result.value.portraitBase64.length).toBeGreaterThan(0);
  });

  it('adapter reports response body timeouts as network timeouts, not parse errors', async () => {
    const timeout = Object.assign(new Error('body read timed out'), { name: 'TimeoutError' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(timeout)
      } as unknown as Response))
    );
    const seam = createWigTryOnSeam(mockConfigSeam);
    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('WIG_TRY_ON_NETWORK_ERROR');
      expect(result.error.message).toContain('timed out');
    }
  });
});
