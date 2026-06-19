// Purpose: Build the production RateLimitSeam instance from environment-configured limits.
// Why: Keep env parsing out of hooks.server.ts so the limiter stays a thin, testable wiring step.
// Info flow: env -> validated RateLimitConfig -> pure fixed-window limiter (in-memory, per server instance).
import type { RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import { createRateLimitSeam as createPureRateLimitSeam } from '../../seams/rate-limit-seam/limiter';
import { env as privateEnv } from '$env/dynamic/private';

const DEFAULT_MAX_REQUESTS = 20;
const DEFAULT_WINDOW_MS = 60_000;

const optionalPositiveInteger = (
	value: string | undefined
): number | undefined => {
	if (value === undefined || value.trim() === '') return undefined;
	if (!/^\d+$/.test(value.trim())) return undefined;
	const parsed = Number(value);
	return parsed > 0 ? parsed : undefined;
};

export const createRateLimitSeam = (
	env: Record<string, string | undefined> = privateEnv
): RateLimitSeam =>
	createPureRateLimitSeam({
		maxRequests:
			optionalPositiveInteger(env.RATE_LIMIT_MAX_REQUESTS) ??
			DEFAULT_MAX_REQUESTS,
		windowMs:
			optionalPositiveInteger(env.RATE_LIMIT_WINDOW_MS) ?? DEFAULT_WINDOW_MS
	});
