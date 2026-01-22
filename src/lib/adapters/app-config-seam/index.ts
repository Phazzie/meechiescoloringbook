import type { AppConfig, AppConfigSeam } from '../../seams/app-config-seam/contract';
import { validateAppConfig } from '../../seams/app-config-seam/validators';

const readConfig = (env: NodeJS.ProcessEnv): AppConfig => {
  const config = {
    xaiApiKey: env.XAI_API_KEY,
    xaiTextModel: env.XAI_TEXT_MODEL,
    xaiImageModel: env.XAI_IMAGE_MODEL,
    xaiBaseUrl: env.XAI_BASE_URL,
    xaiImageEndpointPath: env.XAI_IMAGE_ENDPOINT_PATH,
    featureIntegrationTests: env.FEATURE_INTEGRATION_TESTS === 'true',
    maxImagesPerRequest: Number(env.MAX_IMAGES_PER_REQUEST),
    defaultImageSize: env.DEFAULT_IMAGE_SIZE
  };

  return validateAppConfig(config);
};

export const createAppConfigSeam = (env: NodeJS.ProcessEnv = process.env): AppConfigSeam => ({
  getConfig: () => readConfig(env)
});
