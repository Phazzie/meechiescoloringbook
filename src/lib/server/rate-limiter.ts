// Purpose: Enforce per-client rate limits on paid AI-calling API routes.
// Why: Routes call billed xAI/Gemini providers; without a cap a single client can run up cost.
// Info flow: route request -> getClientAddress -> RateLimitSeam.checkAndConsume -> 429 Response or null.
import { z } from 'zod';
import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { createRateLimitSeam } from '$lib/seams/rate-limit-seam/policy';
import type { RateLimitSeam } from '$lib/seams/rate-limit-seam/contract';

// Module-scope singleton: state persists across requests handled by the same
// warm serverless instance. This is a best-effort, per-process cap, not a
// distributed one — see DECISIONS.md (RateLimitSeam) for the accepted tradeoff.
const sharedRateLimitSeam: RateLimitSeam = createRateLimitSeam();

const DEFAULT_RATE_LIMIT_CONFIG = {
	rateLimitMaxRequests: 20,
	rateLimitWindowMs: 60_000
};

// Each field is parsed independently so an out-of-range/invalid value in one
// field falls back to its own default without discarding a valid sibling field.
const rateLimitMaxRequestsSchema = z.number().int().min(1).max(1000);
const rateLimitWindowMsSchema = z.number().int().min(1000).max(3_600_000);

const optionalInteger = (value: string | undefined): number | undefined => {
	if (value === undefined || value.trim() === '') return undefined;
	if (!/^\d+$/.test(value.trim())) return undefined;
	return Number(value);
};

// All clients whose address lookup fails share this one key. A unique key per
// failure would let any client bypass rate limiting entirely by causing
// getClientAddress() to throw (e.g. omitting/malforming a forwarded-for
// header) — that defeats the limiter's purpose of capping paid-provider
// billing, which is worse than unidentifiable clients sharing one bucket.
const UNKNOWN_CLIENT_KEY = 'unknown-client';

// Deliberately decoupled from AppConfigSeam: rate limiting must keep working
// even when unrelated required config (e.g. xaiApiKey) is absent or mocked.
export const readRateLimitConfig = (env: Record<string, string | undefined> = privateEnv) => {
	const maxRequestsParsed = rateLimitMaxRequestsSchema.safeParse(
		optionalInteger(env.RATE_LIMIT_MAX_REQUESTS)
	);
	const windowMsParsed = rateLimitWindowMsSchema.safeParse(
		optionalInteger(env.RATE_LIMIT_WINDOW_MS)
	);
	return {
		rateLimitMaxRequests: maxRequestsParsed.success
			? maxRequestsParsed.data
			: DEFAULT_RATE_LIMIT_CONFIG.rateLimitMaxRequests,
		rateLimitWindowMs: windowMsParsed.success
			? windowMsParsed.data
			: DEFAULT_RATE_LIMIT_CONFIG.rateLimitWindowMs
	};
};

export type EnforceAiRateLimitDeps = {
	rateLimitSeam?: RateLimitSeam;
	getConfig?: () => { rateLimitMaxRequests: number; rateLimitWindowMs: number };
	now?: () => number;
};

export const enforceAiRateLimit = (
	getClientAddress: () => string,
	deps: EnforceAiRateLimitDeps = {}
): Response | null => {
	const rateLimitSeam = deps.rateLimitSeam ?? sharedRateLimitSeam;
	const getConfig = deps.getConfig ?? readRateLimitConfig;
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
