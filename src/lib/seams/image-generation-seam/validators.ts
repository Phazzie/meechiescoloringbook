// Purpose: Validate ImageGenerationSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const imageGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().min(1),
  n: z.number().int().min(1).max(10),
  size: z.string().min(1),
  format: z.enum(['url', 'b64_json']),
  seed: z.number().int().optional(),
  userTag: z.string().optional()
});

export const generatedImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  b64: z.string().optional()
});

export const imageGenerationResultSchema = z.object({
  images: z.array(generatedImageSchema),
  rawModelInfo: z.record(z.unknown()),
  timingMs: z.number()
});

export const validateImageGenerationRequest = (input: unknown) =>
  imageGenerationRequestSchema.parse(input);

export const validateImageGenerationResult = (input: unknown) =>
  imageGenerationResultSchema.parse(input);
