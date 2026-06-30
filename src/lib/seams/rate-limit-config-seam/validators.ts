// Purpose: Validate and default RateLimitConfigSeam env input.
// Why: Keep runtime data aligned with the contract schema without ever throwing —
//      rate limiting must keep working even when env values are absent or malformed.
// Info flow: raw env strings -> per-field parse+default -> RateLimitConfig.
import { z } from 'zod';
import type { RateLimitConfig } from './contract';

export const rateLimitMaxRequestsSchema = z.number().int().min(1).max(1000);
export const rateLimitWindowMsSchema = z.number().int().min(1000).max(3_600_000);

export const rateLimitConfigSchema = z.object({
	rateLimitMaxRequests: rateLimitMaxRequestsSchema,
	rateLimitWindowMs: rateLimitWindowMsSchema
});

export const validateRateLimitConfig = (config: unknown): RateLimitConfig =>
	rateLimitConfigSchema.parse(config);

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
	rateLimitMaxRequests: 20,
	rateLimitWindowMs: 60_000
};

const optionalInteger = (value: string | undefined): number | undefined => {
	if (value === undefined || value.trim() === '') return undefined;
	if (!/^\d+$/.test(value.trim())) return undefined;
	return Number(value);
};

// Each field is parsed independently so an out-of-range/invalid value in one
// field falls back to its own default without discarding a valid sibling field.
export const readRateLimitConfig = (
	env: Record<string, string | undefined>
): RateLimitConfig => {
	const maxRequestsParsed = rateLimitMaxRequestsSchema.safeParse(
		optionalInteger(env.RATE_LIMIT_MAX_REQUESTS)
	);
	const windowMsParsed = rateLimitWindowMsSchema.safeParse(
		optionalInteger(env.RATE_LIMIT_WINDOW_MS)
	);
	return {
		rateLimitMaxRequests: maxRequestsParsed.success
			? maxRequestsParsed.data
			: DEFAULT_RATE_LIMIT_CONFIG.rateLimitMaxRequests,
		rateLimitWindowMs: windowMsParsed.success
			? windowMsParsed.data
			: DEFAULT_RATE_LIMIT_CONFIG.rateLimitWindowMs
	};
};
