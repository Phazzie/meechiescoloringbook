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
