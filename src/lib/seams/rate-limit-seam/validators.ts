// Purpose: Validate RateLimitSeam inputs and atomic store decisions.
// Why: Reject raw identities, invalid costs, and internally inconsistent quota results.
// Info flow: guard/mock/adapter data -> schemas -> RateLimitSeam contract values.
import { z } from 'zod';

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const TEXT_RATE_LIMIT = 20;
export const IMAGE_RATE_LIMIT = 8;

export const rateLimitBucketSchema = z.enum(['text', 'image']);

export const pseudonymousRateLimitKeySchema = z
	.string()
	.regex(/^rl:(client|fallback):[a-f0-9]{64}$/);

export const rateLimitConsumeInputSchema = z
	.object({
		identityKey: pseudonymousRateLimitKeySchema,
		bucket: rateLimitBucketSchema,
		limit: z.number().int().positive(),
		windowMs: z.number().int().positive(),
		cost: z.number().int().positive()
	})
	.strict();

export const rateLimitDecisionSchema = z
	.object({
		allowed: z.boolean(),
		limit: z.number().int().positive(),
		used: z.number().int().positive(),
		remaining: z.number().int().nonnegative(),
		resetAtMs: z.number().int().positive()
	})
	.strict()
	.superRefine((decision, context) => {
		const expectedAllowed = decision.used <= decision.limit;
		const expectedRemaining = Math.max(decision.limit - decision.used, 0);
		if (decision.allowed !== expectedAllowed) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['allowed'],
				message: 'Allowed state does not match quota usage.'
			});
		}
		if (decision.remaining !== expectedRemaining) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['remaining'],
				message: 'Remaining quota does not match quota usage.'
			});
		}
	});

export type RateLimitBucket = z.infer<typeof rateLimitBucketSchema>;
export type RateLimitConsumeInput = z.infer<typeof rateLimitConsumeInputSchema>;
export type RateLimitDecision = z.infer<typeof rateLimitDecisionSchema>;

export const validateRateLimitConsumeInput = (input: unknown): RateLimitConsumeInput =>
	rateLimitConsumeInputSchema.parse(input);

export const validateRateLimitDecision = (input: unknown): RateLimitDecision =>
	rateLimitDecisionSchema.parse(input);
