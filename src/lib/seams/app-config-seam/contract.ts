// Purpose: Define AppConfigSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
export type AppConfig = {
  xaiApiKey: string;
  xaiTextModel: string;
  xaiImageModel: string;
  xaiBaseUrl: string;
  xaiImageEndpointPath: string;
  featureIntegrationTests: boolean;
  maxImagesPerRequest: number;
  defaultImageSize: string;
};

export type AppConfigSeam = {
  getConfig: () => AppConfig;
};
