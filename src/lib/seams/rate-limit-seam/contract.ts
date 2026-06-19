// Purpose: Define RateLimitSeam contract types.
// Why: Gate abuse-prone, billable API routes behind a deterministic fixed-window limiter.
// Info flow: hooks.server.ts -> RateLimitSeam.checkAndConsume -> Result<RateLimitDecision, RateLimitError> -> 429 or pass-through.
import type { Result } from '../../../../contracts/shared.contract';

export type RateLimitConfig = {
	maxRequests: number;
	windowMs: number;
};

export type RateLimitCheckRequest = {
	key: string;
	nowMs: number;
};

export type RateLimitDecision = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAtMs: number;
	retryAfterMs: number;
};

// RATE_LIMIT_INVALID_KEY: the request key was missing or not a non-empty string.
export type RateLimitError = {
	code: 'RATE_LIMIT_INVALID_KEY';
	message: string;
};

export type RateLimitSeam = {
	checkAndConsume: (
		request: RateLimitCheckRequest
	) => Result<RateLimitDecision, RateLimitError>;
};
