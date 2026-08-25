// Purpose: Contract tests for ImageProviderConfigSeam.
// Why: Enforce mock adherence to the seam contract; red proof that fault fixture fails validation.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { createImageProviderConfigSeam } from '../../adapters/image-provider-config-seam';
import { imageProviderConfigFixture, imageProviderConfigFaultFixture } from './fixtures';
import { createMockImageProviderConfigSeam } from './mock';
import { validateImageProviderConfig } from './validators';

describe('ImageProviderConfigSeam mock contract', () => {
  it('returns a validated config on the sample scenario', () => {
    const seam = createMockImageProviderConfigSeam('sample');
    const config = seam.getConfig();
    expect(config).toEqual(imageProviderConfigFixture);
    expect(validateImageProviderConfig(config)).toEqual(imageProviderConfigFixture);
  });

  it('fault fixture fails validation (red proof)', () => {
    const seam = createMockImageProviderConfigSeam('fault');
    const config = seam.getConfig();
    expect(config).toEqual(imageProviderConfigFaultFixture);
    expect(() => validateImageProviderConfig(config)).toThrow();
  });

  it('config contains only image-provider keys and no text-model fields', () => {
    const seam = createMockImageProviderConfigSeam('sample');
    const config = seam.getConfig();
    expect(Object.keys(config).sort()).toEqual(
      ['xaiApiKey', 'xaiImageModel', 'xaiBaseUrl', 'xaiImageEndpointPath'].sort()
    );
    expect(config).not.toHaveProperty('xaiTextModel');
    expect(config).not.toHaveProperty('geminiApiKey');
    expect(config).not.toHaveProperty('featureIntegrationTests');
  });

  it('uses documented defaults when optional image env values are absent', () => {
    const seam = createImageProviderConfigSeam({ XAI_API_KEY: 'test-key' });
    expect(seam.getConfig()).toEqual({
      xaiApiKey: 'test-key',
      xaiImageModel: 'grok-imagine-image',
      xaiBaseUrl: 'https://api.x.ai',
      xaiImageEndpointPath: '/v1/images/generations'
    });
  });

  // The model id is pinned in code, not read from env, so a stale deployment variable
  // cannot silently override it — the failure mode that pinned production text generation
  // to a retired model until it was found by hand.
  it('ignores XAI_IMAGE_MODEL from the environment', () => {
    const seam = createImageProviderConfigSeam({
      XAI_API_KEY: 'test-key',
      XAI_IMAGE_MODEL: 'stale-retired-model'
    });
    expect(seam.getConfig().xaiImageModel).toBe('grok-imagine-image');
  });

  it('rejects malformed base URLs as config errors', () => {
    const seam = createImageProviderConfigSeam({
      XAI_API_KEY: 'test-key',
      XAI_BASE_URL: 'api.x.ai'
    });
    expect(() => seam.getConfig()).toThrow();
  });
});
