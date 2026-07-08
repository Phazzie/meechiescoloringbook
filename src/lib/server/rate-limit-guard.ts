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
	wigTryOn: { limit: 6, windowMs: 60_000 }
} as const satisfies Record<string, RateLimitConfig>;

export const guardRateLimit = (
	routeName: string,
	clientAddress: string,
	config: RateLimitConfig
): RateLimitGuardResult => {
	const decision = rateLimitSeam.consume(`${routeName}:${clientAddress}`, config);
	if (decision.ok) return { ok: true };

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
