// Purpose: Mock $env/dynamic/private for integration tests.
// Why: Integration tests run outside SvelteKit so SvelteKit's env module is unavailable;
//      this mock provides all required config keys so seam adapters can be exercised.
// Info flow: vitest.integration.config.ts aliases $env/dynamic/private to this file →
//            seam adapters read keys → integration tests exercise real adapter logic.
export const env = {
  XAI_API_KEY: process.env.XAI_API_KEY || 'test-key',
  XAI_TEXT_MODEL: process.env.XAI_TEXT_MODEL || 'grok-4-1-fast-reasoning',
  XAI_IMAGE_MODEL: process.env.XAI_IMAGE_MODEL || 'grok-imagine-image',
  XAI_BASE_URL: process.env.XAI_BASE_URL || 'https://api.x.ai',
  XAI_IMAGE_ENDPOINT_PATH: process.env.XAI_IMAGE_ENDPOINT_PATH || '/v1/images/generations',
  FEATURE_INTEGRATION_TESTS: process.env.FEATURE_INTEGRATION_TESTS || 'false',
  MAX_IMAGES_PER_REQUEST: process.env.MAX_IMAGES_PER_REQUEST || '4',
  DEFAULT_IMAGE_SIZE: process.env.DEFAULT_IMAGE_SIZE || '1024x1024',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
  FAL_KEY: process.env.FAL_KEY || 'test-key',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'test-key',
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'
};
