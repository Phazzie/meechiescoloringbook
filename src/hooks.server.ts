// Purpose: Rate-limit POST requests to /api/* before they reach billable provider-calling routes.
// Why: xAI and Gemini calls are billed per request and were previously unprotected by any
//      request-volume control; a single Handle hook avoids touching all six route handlers.
// Info flow: incoming request -> client address key -> RateLimitSeam.checkAndConsume -> 429 short-circuit or resolve(event).
import type { Handle } from '@sveltejs/kit';
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';

// One in-memory limiter per server instance/lambda invocation lifetime; module-scoped so state
// persists across requests handled by the same instance.
const rateLimitSeam = createRateLimitSeam();

const rateLimitedResponse = (retryAfterMs: number) =>
	new Response(
		JSON.stringify({
			ok: false,
			error: {
				code: 'RATE_LIMITED',
				message: 'Too many requests. Please slow down and try again shortly.'
			}
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(Math.ceil(retryAfterMs / 1000))
			}
		}
	);

export const handle: Handle = async ({ event, resolve }) => {
	if (
		event.request.method !== 'POST' ||
		!event.url.pathname.startsWith('/api/')
	) {
		return resolve(event);
	}

	let key: string;
	try {
		key = event.getClientAddress();
	} catch {
		// Fail open: if the platform cannot resolve a client address, don't block the request.
		return resolve(event);
	}

	const decision = rateLimitSeam.checkAndConsume({ key, nowMs: Date.now() });
	if (decision.ok && !decision.value.allowed) {
		return rateLimitedResponse(decision.value.retryAfterMs);
	}

	return resolve(event);
};
