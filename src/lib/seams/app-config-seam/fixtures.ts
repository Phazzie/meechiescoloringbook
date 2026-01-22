import type { AppConfig } from './contract';

export const appConfigFixture: AppConfig = {
  xaiApiKey: 'fixture-key',
  xaiTextModel: 'grok-4.1-fast-reasoning',
  xaiImageModel: 'grok-2-image',
  xaiBaseUrl: 'https://api.x.ai/v1',
  xaiImageEndpointPath: '/images/generations',
  featureIntegrationTests: false,
  maxImagesPerRequest: 4,
  defaultImageSize: '1024x1024'
};
