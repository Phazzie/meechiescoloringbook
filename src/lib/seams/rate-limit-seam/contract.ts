// Purpose: Define RateLimitSeam contract types.
// Why: Bound request volume against metered external AI providers (xAI, Gemini) so a single
//      client cannot exhaust API budget or induce provider throttling for everyone else.
// Info flow: route handler -> RateLimitSeam.consume(key, config) -> Result -> 429 response or pass-through.
import type { Result } from '../../../../contracts/shared.contract';

// RATE_LIMIT_EXCEEDED: the key has consumed its full quota within the current window.
export type RateLimitErrorCode = 'RATE_LIMIT_EXCEEDED';

export type RateLimitError = {
	code: RateLimitErrorCode;
	message: string;
	retryAfterMs: number;
};

export type RateLimitDecision = {
	remaining: number;
	limit: number;
	resetAt: number;
};

export type RateLimitConfig = {
	/** Maximum allowed calls per key within windowMs. */
	limit: number;
	/** Fixed window length in milliseconds. */
	windowMs: number;
};

export type RateLimitSeam = {
	/** Consume one unit of quota for `key` under `config`, evaluated at the current instant. */
	consume: (key: string, config: RateLimitConfig) => Result<RateLimitDecision, RateLimitError>;
};
