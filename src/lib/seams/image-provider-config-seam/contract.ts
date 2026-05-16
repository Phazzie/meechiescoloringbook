// Purpose: Define ImageProviderConfigSeam contract types.
// Why: Isolate image-provider config from text-model and other unrelated env keys so the
//      image-generation route does not fail at startup when XAI_TEXT_MODEL is absent.
// Info flow: env keys -> adapter -> ImageProviderConfig -> ImageGenerationSeam adapter.
import type { ImageProviderConfig } from './validators';

export type { ImageProviderConfig };

export type ImageProviderConfigSeam = {
	getConfig: () => ImageProviderConfig;
};
