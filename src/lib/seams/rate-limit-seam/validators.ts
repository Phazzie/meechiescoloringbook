// Purpose: Validate RateLimitSeam outputs at runtime.
// Why: Keep runtime data aligned with the contract shape.
// Info flow: mock/tests -> validators -> errors.
import { z } from 'zod';

export const rateLimitErrorSchema = z.object({
	code: z.literal('RATE_LIMITED'),
	message: z.string().min(1),
	retryAfterMs: z.number().nonnegative()
});

export const rateLimitResultSchema = z.union([
	z.object({
		ok: z.literal(true),
		remaining: z.number().int().nonnegative(),
		resetAtMs: z.number().nonnegative()
	}),
	z.object({ ok: z.literal(false), error: rateLimitErrorSchema })
]);

export const validateRateLimitResult = (input: unknown) => rateLimitResultSchema.parse(input);
