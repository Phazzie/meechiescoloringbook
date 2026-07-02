// Purpose: Apply RateLimitSeam checks to API routes with a consistent 429 response.
// Why: Every route that calls a paid external AI provider must reject abusive traffic the same
//      way instead of duplicating response shaping in each +server.ts file.
// Info flow: route request -> route name + client address -> RateLimitSeam.consume -> pass-through or 429 Response.
import { json } from '@sveltejs/kit';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { rateLimitSeam } from './rate-limiter';

export type RateLimitCheck = { ok: true } | { ok: false; response: Response };

export const enforceRateLimit = (routeName: string, clientAddress: string): RateLimitCheck => {
	const result = rateLimitSeam.consume({
		key: `${routeName}:${clientAddress}`,
		limit: SYSTEM_CONSTANTS.RATE_LIMIT.MAX_REQUESTS,
		windowMs: SYSTEM_CONSTANTS.RATE_LIMIT.WINDOW_MS
	});

	if (result.ok) return { ok: true };

	return {
		ok: false,
		response: json(
			{ ok: false, error: { code: result.error.code, message: result.error.message } },
			{
				status: 429,
				headers: { 'Retry-After': String(Math.ceil(result.error.retryAfterMs / 1000)) }
			}
		)
	};
};
