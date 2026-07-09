// Purpose: Validate RateLimitSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const rateLimitCheckInputSchema = z.object({
	key: z.string().min(1),
	limit: z.number().int().min(1),
	windowMs: z.number().int().min(1)
});

export const rateLimitCheckValueSchema = z.object({
	allowed: z.boolean(),
	remaining: z.number().int().min(0),
	resetAt: z.number()
});

export const validateRateLimitCheckInput = (input: unknown) => rateLimitCheckInputSchema.parse(input);

export const validateRateLimitCheckValue = (input: unknown) => rateLimitCheckValueSchema.parse(input);
