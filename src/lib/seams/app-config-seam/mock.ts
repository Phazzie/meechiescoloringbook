// Purpose: Mock AppConfigSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { AppConfig, AppConfigSeam } from './contract';

export const mockAppConfig: AppConfig = {
  xaiApiKey: 'mock-api-key',
  xaiTextModel: 'grok-4.1-fast-reasoning',
  xaiImageModel: 'grok-2-image',
  xaiBaseUrl: 'https://api.x.ai/v1',
  xaiImageEndpointPath: '/images/generations',
  featureIntegrationTests: false,
  maxImagesPerRequest: 4,
  defaultImageSize: '1024x1024'
};

export const createMockAppConfigSeam = (config: AppConfig = mockAppConfig): AppConfigSeam => ({
  getConfig: () => config
});
