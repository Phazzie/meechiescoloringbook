// Purpose: Define RateLimitSeam contract types.
// Why: Bound abuse of routes that call paid external AI providers without requiring new infrastructure.
// Info flow: contract types -> limiter implementation -> API routes.

export type RateLimitError = {
	code: 'RATE_LIMITED';
	message: string;
	retryAfterMs: number;
};

export type RateLimitResult =
	| { ok: true; remaining: number; resetAtMs: number }
	| { ok: false; error: RateLimitError };

export type RateLimitConsumeInput = {
	/** Unique identifier for the caller being limited, e.g. `${routeName}:${clientIp}`. */
	key: string;
	/** Maximum number of requests allowed per window. */
	limit: number;
	/** Window length in milliseconds. */
	windowMs: number;
};

export type RateLimitSeam = {
	consume: (input: RateLimitConsumeInput) => RateLimitResult;
};
