// Purpose: Centralize per-route rate limit values for all public API routes.
// Why: Keep limit/window tuning in one place instead of duplicated literals in each route handler.
// Info flow: route handler -> RATE_LIMIT_CONFIG[routeName] -> checkRateLimit.
export type RateLimitRouteConfig = { limit: number; windowMs: number };

export const RATE_LIMIT_CONFIG = {
	generate: { limit: 5, windowMs: 60_000 },
	'image-generation': { limit: 5, windowMs: 60_000 },
	'chat-interpretation': { limit: 10, windowMs: 60_000 },
	tools: { limit: 10, windowMs: 60_000 },
	'wig-try-on': { limit: 5, windowMs: 60_000 },
	'meechie-studio-text': { limit: 10, windowMs: 60_000 }
} as const satisfies Record<string, RateLimitRouteConfig>;

export type RateLimitedRouteName = keyof typeof RATE_LIMIT_CONFIG;
