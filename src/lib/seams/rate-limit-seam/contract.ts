// Purpose: Define RateLimitSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> limiter/mock/tests -> route handlers.
import type { Result } from '../../../../contracts/shared.contract';

export type RateLimitErrorCode = 'RATE_LIMIT_EXCEEDED' | 'RATE_LIMIT_INPUT_INVALID';

export type RateLimitError =
	| { code: 'RATE_LIMIT_EXCEEDED'; message: string; resetAtMs: number }
	| { code: 'RATE_LIMIT_INPUT_INVALID'; message: string };

export type RateLimitStatus = {
	limit: number;
	remaining: number;
	resetAtMs: number;
};

export type RateLimitCheckInput = {
	/** Caller-built key, e.g. `${routeName}:${clientIp}`. Distinct keys track independent budgets. */
	key: string;
	/** Maximum allowed hits within windowMs for this key. */
	limit: number;
	/** Sliding window size in milliseconds. */
	windowMs: number;
	/** Caller-supplied clock reading so the seam stays deterministic and testable. */
	nowMs: number;
};

export type RateLimitResult = Result<RateLimitStatus, RateLimitError>;

export type RateLimitSeam = {
	/** Records one hit for `key` and reports whether it stays within the configured budget. */
	checkAndConsume: (input: RateLimitCheckInput) => RateLimitResult;
};
