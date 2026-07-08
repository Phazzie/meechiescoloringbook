// Purpose: Shared per-route rate-limit guard for API endpoints that call metered AI providers.
// Why: Keep the 429 response shape and key derivation in one place instead of duplicating it in
//      every +server.ts that fronts a paid xAI/Gemini call.
// Info flow: RequestEvent (route name + client address) -> RateLimitSeam.consume -> ParseResult-style guard.
import { json } from '@sveltejs/kit';
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';
import type { RateLimitConfig } from '$lib/seams/rate-limit-seam/contract';

// One seam instance per server process: state must persist across requests to bound anything.
// See src/lib/seams/rate-limit-seam/probe.ts for the accepted per-instance-only limitation.
const rateLimitSeam = createRateLimitSeam();

export type RateLimitGuardResult = { ok: true } | { ok: false; response: Response };

export const RATE_LIMIT_CONFIGS = {
	generate: { limit: 8, windowMs: 60_000 },
	imageGeneration: { limit: 10, windowMs: 60_000 },
	chatInterpretation: { limit: 20, windowMs: 60_000 },
	meechieStudioText: { limit: 20, windowMs: 60_000 },
	wigTryOn: { limit: 6, windowMs: 60_000 },
	tools: { limit: 20, windowMs: 60_000 }
} as const satisfies Record<string, RateLimitConfig>;

export const guardRateLimit = async (
	routeName: string,
	clientAddress: string | (() => string),
	config: RateLimitConfig
): Promise<RateLimitGuardResult> => {
	// getClientAddress() can throw when the deployment platform doesn't supply the expected
	// headers (e.g. certain proxy setups or local testing). A shared fallback bucket would turn
	// that failure into a route-wide denial of service (the first few requests would exhaust
	// the bucket and every other client would get 429s for the rest of the window), so instead
	// fail open: without a real client key there is nothing safe to bound, and the guard's job
	// is to add protection, not manufacture a new outage when address resolution is unavailable.
	let resolvedAddress: string;
	try {
		resolvedAddress = typeof clientAddress === 'function' ? clientAddress() : clientAddress;
	} catch {
		return { ok: true };
	}

	const decision = await rateLimitSeam.consume(`${routeName}:${resolvedAddress}`, config);
	if (decision.ok) return { ok: true };

	// RATE_LIMIT_CONFIG_INVALID means the caller passed bad input (a bug), not client abuse —
	// surface it as a 500 rather than telling the client to slow down.
	if (decision.error.code === 'RATE_LIMIT_CONFIG_INVALID') {
		return {
			ok: false,
			response: json(
				{ ok: false, error: { code: decision.error.code, message: decision.error.message } },
				{ status: 500 }
			)
		};
	}

	return {
		ok: false,
		response: json(
			{ ok: false, error: { code: decision.error.code, message: decision.error.message } },
			{
				status: 429,
				headers: { 'Retry-After': Math.ceil(decision.error.retryAfterMs / 1000).toString() }
			}
		)
	};
};
