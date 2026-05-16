// Purpose: Contract tests for ImageProviderConfigSeam.
// Why: Enforce mock adherence to the seam contract; red proof that fault fixture fails validation.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
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
    expect(Object.keys(config)).toEqual(
      expect.arrayContaining(['xaiApiKey', 'xaiImageModel', 'xaiBaseUrl', 'xaiImageEndpointPath'])
    );
    expect(config).not.toHaveProperty('xaiTextModel');
    expect(config).not.toHaveProperty('geminiApiKey');
    expect(config).not.toHaveProperty('featureIntegrationTests');
  });
});
