import { z } from 'zod';

export const appConfigSchema = z.object({
  xaiApiKey: z.string().min(1),
  xaiTextModel: z.string().min(1),
  xaiImageModel: z.string().min(1),
  xaiBaseUrl: z.string().min(1),
  xaiImageEndpointPath: z.string().min(1),
  featureIntegrationTests: z.boolean(),
  maxImagesPerRequest: z.number().int().min(1).max(10),
  defaultImageSize: z.string().min(1)
});

export const validateAppConfig = (config: unknown) => appConfigSchema.parse(config);
