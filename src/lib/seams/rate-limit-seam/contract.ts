// Purpose: Define RateLimitSeam contract types and Zod schemas.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types/schemas -> limiter/mock/tests -> route handlers.
import { z } from 'zod';
import { NonEmptyStringSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';

export const RateLimitErrorCodeSchema = z.enum(['RATE_LIMIT_EXCEEDED', 'RATE_LIMIT_INPUT_INVALID']);

export type RateLimitErrorCode = z.infer<typeof RateLimitErrorCodeSchema>;

export const RateLimitErrorSchema = z.discriminatedUnion('code', [
	z.object({
		code: z.literal('RATE_LIMIT_EXCEEDED'),
		message: NonEmptyStringSchema,
		resetAtMs: z.number()
	}),
	z.object({
		code: z.literal('RATE_LIMIT_INPUT_INVALID'),
		message: NonEmptyStringSchema
	})
]);

export type RateLimitError = z.infer<typeof RateLimitErrorSchema>;

export const RateLimitStatusSchema = z.object({
	limit: z.number(),
	remaining: z.number(),
	resetAtMs: z.number()
});

export type RateLimitStatus = z.infer<typeof RateLimitStatusSchema>;

export const RateLimitCheckInputSchema = z.object({
	/** Caller-built key, e.g. `${routeName}:${clientIp}`. Distinct keys track independent budgets. */
	key: NonEmptyStringSchema,
	/** Maximum allowed hits within windowMs for this key. */
	limit: z.number().int().positive(),
	/** Sliding window size in milliseconds. */
	windowMs: z.number().finite().positive(),
	/** Caller-supplied clock reading so the seam stays deterministic and testable. */
	nowMs: z.number().finite().nonnegative()
});

export type RateLimitCheckInput = z.infer<typeof RateLimitCheckInputSchema>;

export type RateLimitResult = Result<RateLimitStatus, RateLimitError>;

export type RateLimitSeam = {
	/** Records one hit for `key` and reports whether it stays within the configured budget. */
	checkAndConsume: (input: RateLimitCheckInput) => RateLimitResult;
};
