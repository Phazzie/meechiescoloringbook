// Purpose: Enforce per-client rate limits on paid AI-calling API routes.
// Why: Routes call billed xAI/Gemini providers; without a cap a single client can run up cost.
// Info flow: route request -> getClientAddress -> RateLimitSeam.checkAndConsume -> 429 Response or null.
import { json } from '@sveltejs/kit';
import { createRateLimitConfigSeam } from '$lib/adapters/rate-limit-config-seam';
import { createRateLimitSeam } from '$lib/seams/rate-limit-seam/policy';
import type { RateLimitSeam } from '$lib/seams/rate-limit-seam/contract';
import type { RateLimitConfig, RateLimitConfigSeam } from '$lib/seams/rate-limit-config-seam/contract';

// Module-scope singletons: state/config persist across requests handled by the
// same warm serverless instance. The rate limit window is a best-effort,
// per-process cap, not a distributed one — see DECISIONS.md (RateLimitSeam)
// for the accepted tradeoff. Env reads flow through RateLimitConfigSeam
// (src/lib/adapters/rate-limit-config-seam) rather than this module reading
// $env/dynamic/private directly, per the AGENTS.md seam-adapter-only I/O mandate.
const sharedRateLimitSeam: RateLimitSeam = createRateLimitSeam();
const sharedRateLimitConfigSeam: RateLimitConfigSeam = createRateLimitConfigSeam();

// All clients whose address lookup fails share this one key. A unique key per
// failure would let any client bypass rate limiting entirely by causing
// getClientAddress() to throw (e.g. omitting/malforming a forwarded-for
// header) — that defeats the limiter's purpose of capping paid-provider
// billing, which is worse than unidentifiable clients sharing one bucket.
const UNKNOWN_CLIENT_KEY = 'unknown-client';

export type EnforceAiRateLimitDeps = {
	rateLimitSeam?: RateLimitSeam;
	getConfig?: () => RateLimitConfig;
	now?: () => number;
};

export const enforceAiRateLimit = (
	getClientAddress: () => string,
	deps: EnforceAiRateLimitDeps = {}
): Response | null => {
	const rateLimitSeam = deps.rateLimitSeam ?? sharedRateLimitSeam;
	const getConfig = deps.getConfig ?? (() => sharedRateLimitConfigSeam.getConfig());
	const now = deps.now ?? Date.now;
	const config = getConfig();

	let clientKey: string;
	try {
		clientKey = getClientAddress();
	} catch {
		clientKey = UNKNOWN_CLIENT_KEY;
	}

	const result = rateLimitSeam.checkAndConsume({
		key: clientKey,
		maxRequests: config.rateLimitMaxRequests,
		windowMs: config.rateLimitWindowMs,
		now: now()
	});

	if (result.ok) return null;

	return json(
		{ ok: false, error: { code: result.error.code, message: result.error.message } },
		{
			status: 429,
			headers: { 'Retry-After': Math.ceil(result.error.retryAfterMs / 1000).toString() }
		}
	);
};
