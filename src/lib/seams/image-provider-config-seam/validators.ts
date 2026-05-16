// Purpose: Validate ImageProviderConfigSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const imageProviderConfigSchema = z.object({
	xaiApiKey: z.string().min(1),
	xaiImageModel: z.string().min(1),
	xaiBaseUrl: z.string().url(),
	xaiImageEndpointPath: z.string().min(1)
});

export type ImageProviderConfig = z.infer<typeof imageProviderConfigSchema>;

export const validateImageProviderConfig = (config: unknown) =>
	imageProviderConfigSchema.parse(config);
