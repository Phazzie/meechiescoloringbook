// Purpose: Define RateLimitSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
export type RateLimitCheckInput = {
	key: string;
	maxRequests: number;
	windowMs: number;
	now: number;
};

export type RateLimitAllowed = {
	ok: true;
	remaining: number;
	resetAt: number;
};

export type RateLimitErrorCode = 'RATE_LIMIT_EXCEEDED';

export type RateLimitError = {
	code: RateLimitErrorCode;
	message: string;
	retryAfterMs: number;
	resetAt: number;
};

export type RateLimitDenied = {
	ok: false;
	error: RateLimitError;
};

export type RateLimitResult = RateLimitAllowed | RateLimitDenied;

export type RateLimitSeam = {
	checkAndConsume: (input: RateLimitCheckInput) => RateLimitResult;
	reset: () => void;
};
