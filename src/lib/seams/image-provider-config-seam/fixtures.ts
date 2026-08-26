// Purpose: Provide fixture data for ImageProviderConfigSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { imageProviderConfigSchema } from './validators';
import type { ImageProviderConfig } from './contract';

// Parsed at module load so schema drift surfaces as a ZodError immediately.
export const imageProviderConfigFixture: ImageProviderConfig = imageProviderConfigSchema.parse({
  xaiApiKey: 'fixture-key',
  xaiImageModel: 'grok-imagine-image-2.0',
  xaiBaseUrl: 'https://api.x.ai',
  xaiImageEndpointPath: '/v1/images/generations'
});

// Intentionally invalid: empty xaiApiKey triggers validation failure.
// Not parsed at module load — doing so would throw at import time and break all consumers.
export const imageProviderConfigFaultFixture = {
  xaiApiKey: '',
  xaiImageModel: 'grok-imagine-image-2.0',
  xaiBaseUrl: 'https://api.x.ai',
  xaiImageEndpointPath: '/v1/images/generations'
} as unknown as ImageProviderConfig;

export const getImageProviderConfigFixture = (scenario: 'sample' | 'fault' = 'sample') =>
  scenario === 'fault' ? imageProviderConfigFaultFixture : imageProviderConfigFixture;
