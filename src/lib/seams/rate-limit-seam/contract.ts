// Purpose: Define RateLimitSeam contract types.
// Why: Bound how often a client can hit paid AI-provider-backed endpoints without adding
//      per-route ad-hoc counters.
// Info flow: contract types -> adapter (stateful counters) / mock (fixed decisions) -> routes.
import type { Result } from '../../../../contracts/shared.contract';

export type RateLimitError = {
	code: 'RATE_LIMIT_EXCEEDED';
	message: string;
	retryAfterMs: number;
};

export type RateLimitRule = {
	/** Maximum allowed calls per window for a single key. */
	limit: number;
	/** Sliding window size in milliseconds. */
	windowMs: number;
};

export type RateLimitSeam = {
	/** Record a call attempt for `key` at time `now` (ms epoch) and report whether it is allowed. */
	checkAndConsume: (key: string, now: number) => Result<undefined, RateLimitError>;
};
