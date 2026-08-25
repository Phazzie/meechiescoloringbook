// Purpose: Integration tests for ImageGenerationSeam.
// Why: Validate live adapter behavior when integration tests are enabled.
// Info flow: test -> seam adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { createImageProviderConfigSeam } from '../../src/lib/adapters/image-provider-config-seam';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';

const featureEnabled = process.env.FEATURE_INTEGRATION_TESTS === 'true';
// src/routes/api/image-generation/+server.ts composes ImageProviderConfigSeam, not
// AppConfigSeam: it needs XAI_API_KEY and defaults the model, base URL, and endpoint
// path. Gating on the full AppConfig set would silently skip a supported production
// configuration, and gating on the key alone (as this did before) let it run
// half-configured against AppConfigSeam and fail with IMAGE_CONFIG_ERROR.
const hasImageConfig = Boolean(process.env.XAI_API_KEY);

describe('ImageGenerationSeam integration', () => {
  const runTest = featureEnabled && hasImageConfig;

  if (runTest) {
    it('generates an image via xAI and returns a Result', async () => {
      const configSeam = createImageProviderConfigSeam();
      const imageSeam = createImageGenerationSeam(configSeam);
      const result = await imageSeam.generate({
        prompt: 'a bow-wearing kitten in a glam setting',
        negativePrompt: 'color, shading, grayscale',
        n: 1,
        size: '1024x1024',
        format: 'url'
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.images.length).toBeGreaterThan(0);
      expect(result.value.timingMs).toBeGreaterThan(0);
      // Live image generation takes far longer than the 5000ms default, and the
      // provider adapter allows 3 attempts at a 120s image timeout plus backoff
      // (provider-adapter.adapter.ts IMAGE_TIMEOUT_MS / RETRY_OPTIONS). This test
      // never carried a timeout at all because it could not load until the
      // integration harness resolved its imports, so the gap was invisible.
    }, 200_000);
  } else {
    it.skip('is skipped when integration flag or API key is missing', () => {
      expect(true).toBe(true);
    });
  }
});
