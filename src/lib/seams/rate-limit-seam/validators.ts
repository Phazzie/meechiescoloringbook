// Purpose: Validate RateLimitSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const rateLimitConfigSchema = z.object({
	maxRequests: z.number().int().min(1),
	windowMs: z.number().int().min(1)
});

export const rateLimitCheckRequestSchema = z.object({
	key: z.string().min(1),
	nowMs: z.number().int().min(0)
});

export const rateLimitDecisionSchema = z.object({
	allowed: z.boolean(),
	limit: z.number().int().min(1),
	remaining: z.number().int().min(0),
	resetAtMs: z.number().int().min(0),
	retryAfterMs: z.number().int().min(0)
});

export const validateRateLimitConfig = (config: unknown) =>
	rateLimitConfigSchema.parse(config);
export const validateRateLimitCheckRequest = (request: unknown) =>
	rateLimitCheckRequestSchema.parse(request);
export const validateRateLimitDecision = (decision: unknown) =>
	rateLimitDecisionSchema.parse(decision);
