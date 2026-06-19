// Purpose: Enforce per-route request budgets on API endpoints that call metered external AI providers.
// Why: /api/generate, /api/image-generation, /api/chat-interpretation, /api/meechie-studio-text,
//      /api/wig-try-on, and /api/tools each trigger paid xAI/Gemini calls with zero abuse protection.
//      This wraps RateLimitSeam with one policy per route and a 429 response shaped like other endpoint errors.
// Info flow: route handler -> enforceRateLimit(route, event) -> RateLimitSeam.checkAndConsume -> pass-through | 429 Response.
import { json } from '@sveltejs/kit';
import { createRateLimitSeam } from '$lib/seams/rate-limit-seam/limiter';
import type { RateLimitSeam } from '$lib/seams/rate-limit-seam/contract';

export type RateLimitRouteName =
	| 'generate'
	| 'image-generation'
	| 'chat-interpretation'
	| 'meechie-studio-text'
	| 'wig-try-on'
	| 'tools';

export type RateLimitClientEvent = {
	getClientAddress: () => string;
};

type RateLimitPolicy = { limit: number; windowMs: number };

// Image-producing routes hit the priciest provider calls, so they get the tightest budget.
// Text-only routes (chat parsing, Meechie copy) are cheaper per call and get a looser one.
const ROUTE_LIMIT_POLICIES: Record<RateLimitRouteName, RateLimitPolicy> = {
	generate: { limit: 10, windowMs: 10 * 60_000 },
	'image-generation': { limit: 10, windowMs: 10 * 60_000 },
	'wig-try-on': { limit: 10, windowMs: 10 * 60_000 },
	'chat-interpretation': { limit: 30, windowMs: 10 * 60_000 },
	'meechie-studio-text': { limit: 30, windowMs: 10 * 60_000 },
	tools: { limit: 30, windowMs: 10 * 60_000 }
};

// One limiter instance per route per process. On Vercel this means the budget is enforced
// per-serverless-instance, not globally — see DECISIONS.md 2026-06-17 Assumption entry.
const limitersByRoute = new Map<RateLimitRouteName, RateLimitSeam>();

const getLimiter = (route: RateLimitRouteName): RateLimitSeam => {
	let limiter = limitersByRoute.get(route);
	if (!limiter) {
		limiter = createRateLimitSeam();
		limitersByRoute.set(route, limiter);
	}
	return limiter;
};

const resolveClientKey = (route: RateLimitRouteName, event: RateLimitClientEvent): string => {
	let address = 'unknown';
	try {
		address = event.getClientAddress();
	} catch {
		// Some test harnesses and local adapters don't implement getClientAddress(); fall back to
		// a shared bucket rather than throwing, since this limiter is already a best-effort guard.
		// Warn so an unexpected platform-level failure here doesn't silently mask itself.
		console.warn(`enforceRateLimit: getClientAddress() failed for route "${route}"; using shared "unknown" bucket.`);
	}
	return `${route}:${address}`;
};

export type RateLimitGuardResult = { ok: true } | { ok: false; response: Response };

export const enforceRateLimit = (
	route: RateLimitRouteName,
	event: RateLimitClientEvent
): RateLimitGuardResult => {
	const policy = ROUTE_LIMIT_POLICIES[route];
	const result = getLimiter(route).checkAndConsume({
		key: resolveClientKey(route, event),
		limit: policy.limit,
		windowMs: policy.windowMs,
		nowMs: Date.now()
	});

	if (result.ok) return { ok: true };

	if (result.error.code === 'RATE_LIMIT_INPUT_INVALID') {
		// ROUTE_LIMIT_POLICIES are fixed constants and nowMs comes from Date.now(), so this
		// branch is unreachable in practice; fail loudly rather than silently letting traffic through.
		throw new Error(`Invalid rate limit configuration for route "${route}": ${result.error.message}`);
	}

	const retryAfterSeconds = Math.max(0, Math.ceil((result.error.resetAtMs - Date.now()) / 1000));
	return {
		ok: false,
		response: json(
			{
				ok: false,
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: result.error.message,
					details: { retryAfterSeconds: String(retryAfterSeconds) }
				}
			},
			{
				status: 429,
				headers: { 'Retry-After': String(retryAfterSeconds) }
			}
		)
	};
};
