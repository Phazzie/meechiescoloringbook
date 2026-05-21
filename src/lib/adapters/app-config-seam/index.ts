// Purpose: Build the AppConfigSeam adapter from environment values.
// Why: Centralize config parsing and validation.
// Info flow: env -> validators -> seam config.
import type { AppConfig, AppConfigSeam } from '../../seams/app-config-seam/contract';
import { validateAppConfig } from '../../seams/app-config-seam/validators';
import { env as privateEnv } from '$env/dynamic/private';

// Use Record<string, string | undefined> to accept the shape of SvelteKit's private environment
const readConfig = (env: Record<string, string | undefined>): AppConfig => {
	const config = {
		xaiApiKey: env.XAI_API_KEY,
		xaiTextModel: env.XAI_TEXT_MODEL,
		xaiImageModel: env.XAI_IMAGE_MODEL,
		xaiBaseUrl: env.XAI_BASE_URL,
		xaiImageEndpointPath: env.XAI_IMAGE_ENDPOINT_PATH,
		featureIntegrationTests: env.FEATURE_INTEGRATION_TESTS === 'true',
		maxImagesPerRequest: env.MAX_IMAGES_PER_REQUEST !== undefined ? Number(env.MAX_IMAGES_PER_REQUEST) : undefined,
		defaultImageSize: env.DEFAULT_IMAGE_SIZE,
		geminiApiKey: env.GEMINI_API_KEY ?? '',
		geminiBaseUrl: env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com'
	};

	return validateAppConfig(config);
};

export const createAppConfigSeam = (
	env: Record<string, string | undefined> = privateEnv
): AppConfigSeam => ({
	getConfig: () => readConfig(env)
});
