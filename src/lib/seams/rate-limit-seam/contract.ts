// Purpose: Define RateLimitSeam contract types.
// Why: Bound request volume against metered external AI providers (xAI, Gemini) so a single
//      client cannot exhaust API budget or induce provider throttling for everyone else.
// Info flow: route handler -> RateLimitSeam.consume(key, config) -> Result -> 429 response or pass-through.
import type { Result } from '../../../../contracts/shared.contract';

// RATE_LIMIT_EXCEEDED: the key has consumed its full quota within the current window.
// RATE_LIMIT_CONFIG_INVALID: the key or config passed to consume() failed validation — a
//   caller/misconfiguration bug, not client abuse; guardRateLimit maps this to a 500, not a 429.
export type RateLimitErrorCode = 'RATE_LIMIT_EXCEEDED' | 'RATE_LIMIT_CONFIG_INVALID';

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
	/**
	 * Consume one unit of quota for `key` under `config`, evaluated at the current instant.
	 * Async so a future distributed adapter (Vercel KV / Upstash Redis, see DECISIONS.md) can
	 * satisfy this contract without another breaking signature change across every guarded route.
	 */
	consume: (key: string, config: RateLimitConfig) => Promise<Result<RateLimitDecision, RateLimitError>>;
};
