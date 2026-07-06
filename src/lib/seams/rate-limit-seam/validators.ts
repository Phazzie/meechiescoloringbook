// Purpose: Validate RateLimitSeam inputs.
// Why: Reject a misconfigured rule (e.g. limit <= 0 or windowMs <= 0) at construction time
//      instead of silently producing a route that always/never rate-limits.
// Info flow: adapter constructor -> validators -> typed RateLimitRule or thrown ZodError.
import { z } from 'zod';

export const rateLimitRuleSchema = z.object({
	limit: z.number().int().positive(),
	windowMs: z.number().positive()
});

export const validateRateLimitRule = (rule: unknown) => rateLimitRuleSchema.parse(rule);
