// Purpose: Unit tests for AppConfigSeam validation and parsing.
// Why: Ensure environment config is read safely.
// Info flow: test inputs -> validators -> assertions.
import { describe, expect, it } from 'vitest';
import { createAppConfigSeam } from '../../src/lib/adapters/app-config-seam';

const baseEnv = {
  XAI_API_KEY: 'test-key',
  XAI_TEXT_MODEL: 'grok-4.1-fast-reasoning',
  XAI_IMAGE_MODEL: 'grok-2-image',
  XAI_BASE_URL: 'https://api.x.ai/v1',
  XAI_IMAGE_ENDPOINT_PATH: '/images/generations',
  FEATURE_INTEGRATION_TESTS: 'false',
  MAX_IMAGES_PER_REQUEST: '4',
  DEFAULT_IMAGE_SIZE: '1024x1024'
};

describe('AppConfigSeam adapter', () => {
  it('parses valid environment config', () => {
    const seam = createAppConfigSeam(baseEnv);
    const config = seam.getConfig();

    expect(config.xaiApiKey).toBe('test-key');
    expect(config.featureIntegrationTests).toBe(false);
    expect(config.maxImagesPerRequest).toBe(4);
  });

  it('throws when required env vars are missing', () => {
    const seam = createAppConfigSeam({ ...baseEnv, XAI_API_KEY: undefined });
    expect(() => seam.getConfig()).toThrow();
  });
});
