// Purpose: Define RateLimitConfigSeam contract types.
// Why: Isolate rate-limit env reads (RATE_LIMIT_MAX_REQUESTS/RATE_LIMIT_WINDOW_MS) behind a
//      seam adapter instead of a helper reading $env/dynamic/private directly, per the
//      AGENTS.md mandate that all process/env I/O flow through approved seam adapters.
// Info flow: env keys -> adapter -> RateLimitConfig -> rate-limiter.ts.
export type RateLimitConfig = {
	rateLimitMaxRequests: number;
	rateLimitWindowMs: number;
};

export type RateLimitConfigSeam = {
	getConfig: () => RateLimitConfig;
};
