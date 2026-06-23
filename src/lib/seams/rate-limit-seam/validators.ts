// Purpose: Validate RateLimitSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const rateLimitErrorSchema = z.object({
	code: z.literal('RATE_LIMIT_EXCEEDED'),
	message: z.string().min(1),
	retryAfterMs: z.number().int().min(0),
	resetAt: z.number().int().min(0)
});

export const rateLimitResultSchema = z.union([
	z.object({
		ok: z.literal(true),
		remaining: z.number().int().min(0),
		resetAt: z.number().int().min(0)
	}),
	z.object({ ok: z.literal(false), error: rateLimitErrorSchema })
]);

export const validateRateLimitResult = (input: unknown) => rateLimitResultSchema.parse(input);
