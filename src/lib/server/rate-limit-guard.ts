// Purpose: Apply per-route rate limiting before billed/expensive work runs.
// Why: Public API routes have no caller identity check; a single client could otherwise send
//      unlimited requests to routes that call billed third-party AI providers.
// Info flow: route handler -> guard (client address + route name -> RateLimitSeam.check) -> 429 Response or pass-through.
import { json } from '@sveltejs/kit';
import { createRateLimitSeam } from '$lib/seams/rate-limit-seam/policy';
import type { RateLimitSeam } from '$lib/seams/rate-limit-seam/contract';

export type RateLimitGuardResult = { ok: true } | { ok: false; response: Response };

export type RateLimitGuardOptions = {
	routeName: string;
	limit: number;
	windowMs: number;
	getClientAddress: () => string;
	now?: number;
	seam?: RateLimitSeam;
};

// One shared instance per server process: state must persist across requests within
// the process to bound a client's request volume. See DECISIONS.md for the accepted
// limitation that this resets on cold start and is not shared across concurrent instances.
const sharedRateLimitSeam = createRateLimitSeam();

const resolveClientAddress = (getClientAddress: () => string): string => {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
};

export const checkRateLimit = (options: RateLimitGuardOptions): RateLimitGuardResult => {
	const seam = options.seam ?? sharedRateLimitSeam;
	const now = options.now ?? Date.now();
	const key = `${options.routeName}:${resolveClientAddress(options.getClientAddress)}`;
	const result = seam.check({ key, limit: options.limit, windowMs: options.windowMs, now });

	if (result.allowed) {
		return { ok: true };
	}

	const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
	return {
		ok: false,
		response: json(
			{
				ok: false,
				error: {
					code: 'RATE_LIMITED',
					message: 'Too many requests. Please wait before trying again.',
					details: { retryAfterMs: String(result.retryAfterMs) }
				}
			},
			{
				status: 429,
				headers: { 'Retry-After': String(retryAfterSeconds) }
			}
		)
	};
};
