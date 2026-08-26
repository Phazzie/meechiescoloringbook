// Purpose: Validate WigTryOnSeam inputs and outputs.
// Why: Keep runtime try-on payloads aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const wigTryOnMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const wigTryOnRequestSchema = z.object({
  selfieBase64: z.string().min(1),
  selfieMimeType: wigTryOnMimeTypeSchema,
  wigImageBase64: z.string().min(1),
  wigImageMimeType: wigTryOnMimeTypeSchema,
  wigName: z.string().min(1),
  wigStyle: z.string().min(1)
});

export const wigTryOnResultSchema = z.object({
  portraitBase64: z.string().min(1),
  portraitMimeType: wigTryOnMimeTypeSchema,
  timingMs: z.number().nonnegative()
});

export const validateWigTryOnRequest = (input: unknown) => wigTryOnRequestSchema.parse(input);
export const validateWigTryOnResult = (input: unknown) => wigTryOnResultSchema.parse(input);
