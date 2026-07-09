// Purpose: Define RateLimitSeam contract types.
// Why: Give paid AI-provider API routes a shared per-client request budget so a single
//      caller cannot drive unbounded xAI/Gemini provider cost or exhaust the endpoint.
// Info flow: route -> checkLimit({ key, limit, windowMs }) -> allow/deny decision -> 429 or continue.
import type { Result } from '../../../../contracts/shared.contract';

export type RateLimitCheckInput = {
	key: string;
	limit: number;
	windowMs: number;
};

export type RateLimitCheckValue = {
	allowed: boolean;
	remaining: number;
	resetAt: number;
};

export type RateLimitErrorCode = 'RATE_LIMIT_INVALID_INPUT';

export type RateLimitError = {
	code: RateLimitErrorCode;
	message: string;
};

export type RateLimitSeam = {
	checkLimit: (input: RateLimitCheckInput) => Result<RateLimitCheckValue, RateLimitError>;
};
