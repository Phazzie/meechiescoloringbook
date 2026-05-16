// Purpose: Build the ImageProviderConfigSeam adapter from environment values.
// Why: Read only the 4 image-provider env keys so the image-generation route does not
//      fail at startup when XAI_TEXT_MODEL or other unrelated variables are absent.
// Info flow: env -> validateImageProviderConfig -> ImageProviderConfig -> callers.
import type { ImageProviderConfig, ImageProviderConfigSeam } from '../../seams/image-provider-config-seam/contract';
import { validateImageProviderConfig } from '../../seams/image-provider-config-seam/validators';
import { env as privateEnv } from '$env/dynamic/private';

const DEFAULT_XAI_IMAGE_MODEL = 'grok-imagine-image';
const DEFAULT_XAI_BASE_URL = 'https://api.x.ai';
const DEFAULT_XAI_IMAGE_ENDPOINT_PATH = '/v1/images/generations';

const readConfig = (env: Record<string, string | undefined>): ImageProviderConfig =>
	validateImageProviderConfig({
		xaiApiKey: env.XAI_API_KEY,
		xaiImageModel: env.XAI_IMAGE_MODEL ?? DEFAULT_XAI_IMAGE_MODEL,
		xaiBaseUrl: env.XAI_BASE_URL ?? DEFAULT_XAI_BASE_URL,
		xaiImageEndpointPath: env.XAI_IMAGE_ENDPOINT_PATH ?? DEFAULT_XAI_IMAGE_ENDPOINT_PATH
	});

export const createImageProviderConfigSeam = (
	env: Record<string, string | undefined> = privateEnv
): ImageProviderConfigSeam => ({
	getConfig: () => readConfig(env)
});
