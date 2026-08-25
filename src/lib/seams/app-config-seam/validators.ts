// Purpose: Validate AppConfigSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const appConfigSchema = z.object({
	xaiApiKey: z.string().min(1),
	xaiTextModel: z.string().min(1),
	xaiImageModel: z.string().min(1),
	xaiBaseUrl: z.string().min(1),
	xaiImageEndpointPath: z.string().min(1),
	featureIntegrationTests: z.boolean(),
	maxImagesPerRequest: z.number().int().min(1).max(10).default(4),
	// Defaulted like maxImagesPerRequest above: this is an optional deployment value, and a
	// missing one must not fail AppConfig validation and 500 the wig try-on route.
	defaultImageSize: z.string().min(1).default('1024x1024'),
	// geminiApiKey may be empty if the wig try-on feature is not yet configured.
	// An empty key causes WIG_TRY_ON_CONFIG_ERROR at runtime — not a startup failure.
	geminiApiKey: z.string().default(''),
	geminiBaseUrl: z.string().default('https://generativelanguage.googleapis.com')
});

export const validateAppConfig = (config: unknown) => appConfigSchema.parse(config);
