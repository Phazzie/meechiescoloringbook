import { describe, expect, it } from 'vitest';
import { createAppConfigSeam } from '../../src/lib/adapters/app-config-seam';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';

const featureEnabled = process.env.FEATURE_INTEGRATION_TESTS === 'true';
const hasApiKey = Boolean(process.env.XAI_API_KEY);

describe('ImageGenerationSeam integration', () => {
  const runTest = featureEnabled && hasApiKey;

  if (runTest) {
    it('generates an image via xAI', async () => {
      const configSeam = createAppConfigSeam();
      const imageSeam = createImageGenerationSeam(configSeam);
      const result = await imageSeam.generate({
        prompt: 'a bow-wearing kitten in a glam setting',
        negativePrompt: 'color, shading, grayscale',
        n: 1,
        size: '1024x1024',
        format: 'url'
      });

      expect(result.images.length).toBeGreaterThan(0);
    });
  } else {
    it.skip('is skipped when integration flag or API key is missing', () => {
      expect(true).toBe(true);
    });
  }
});
