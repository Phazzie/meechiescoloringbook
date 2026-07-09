// Purpose: Shared server-side rate-limit gate for provider-billed API routes.
// Why: /api/generate, /api/image-generation, /api/chat-interpretation, /api/meechie-studio-text,
//      and /api/wig-try-on are unauthenticated and call metered xAI/Gemini providers. Without a
//      per-client request budget, a single caller can drive unbounded provider cost or exhaust
//      the endpoint. This is a best-effort, per-instance mitigation — see DECISIONS.md.
// Info flow: request -> client address -> RateLimitSeam.checkLimit -> 429 response or null.
import { json } from '@sveltejs/kit';
import type { RateLimitSeam } from '$lib/seams/rate-limit-seam/contract';

export type RateLimitRouteConfig = {
	limit: number;
	windowMs: number;
};

export const enforceRateLimit = (
	seam: RateLimitSeam,
	clientAddress: string,
	routeName: string,
	config: RateLimitRouteConfig
): Response | null => {
	const result = seam.checkLimit({
		key: `${routeName}:${clientAddress}`,
		limit: config.limit,
		windowMs: config.windowMs
	});

	if (!result.ok) {
		// Fail open on a seam-level input error: never let a rate-limit bug block real requests.
		return null;
	}

	if (result.value.allowed) {
		return null;
	}

	const retryAfterSeconds = Math.max(1, Math.ceil((result.value.resetAt - Date.now()) / 1000));
	return json(
		{
			ok: false,
			error: {
				code: 'RATE_LIMIT_EXCEEDED',
				message: 'Too many requests. Please wait before trying again.'
			}
		},
		{ status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
	);
};
