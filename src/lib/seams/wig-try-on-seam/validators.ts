// Purpose: Validate WigTryOnSeam inputs and outputs.
// Why: Keep runtime try-on payloads aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

const mimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const wigTryOnRequestSchema = z.object({
	selfieBase64: z.string().min(1),
	selfieMimeType: mimeTypeSchema,
	wigImageBase64: z.string().min(1),
	wigImageMimeType: mimeTypeSchema,
	wigName: z.string().min(1),
	wigStyle: z.string().min(1)
});

export const wigTryOnResultSchema = z.object({
	portraitBase64: z.string().min(1),
	portraitMimeType: z.string().min(1),
	timingMs: z.number().nonnegative()
});

export const validateWigTryOnRequest = (input: unknown) =>
	wigTryOnRequestSchema.parse(input);
export const validateWigTryOnResult = (input: unknown) =>
	wigTryOnResultSchema.parse(input);
