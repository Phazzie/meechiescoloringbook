// Purpose: Integration tests for ImageGenerationSeam.
// Why: Validate live adapter behavior when integration tests are enabled.
// Info flow: test -> seam adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { createAppConfigSeam } from '../../src/lib/adapters/app-config-seam';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';

const featureEnabled = process.env.FEATURE_INTEGRATION_TESTS === 'true';
// AppConfigSeam requires the full xAI config, not just the key. Gating on the key
// alone let this test run half-configured and fail with IMAGE_CONFIG_ERROR instead
// of skipping, which only became visible once the integration harness could resolve
// its imports at all.
const hasImageConfig = [
	'XAI_API_KEY',
	'XAI_TEXT_MODEL',
	'XAI_IMAGE_MODEL',
	'XAI_BASE_URL',
	'XAI_IMAGE_ENDPOINT_PATH',
	'DEFAULT_IMAGE_SIZE'
].every((name) => Boolean(process.env[name]));

describe('ImageGenerationSeam integration', () => {
  const runTest = featureEnabled && hasImageConfig;

  if (runTest) {
    it('generates an image via xAI and returns a Result', async () => {
      const configSeam = createAppConfigSeam();
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
    });
  } else {
    it.skip('is skipped when integration flag or API key is missing', () => {
      expect(true).toBe(true);
    });
  }
});
