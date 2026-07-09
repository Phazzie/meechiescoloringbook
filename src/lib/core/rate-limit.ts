// Purpose: Pure fixed-window rate limit evaluation over an injected in-memory store.
// Why: Keep the counting algorithm deterministic and testable independent of the real clock;
//      only the adapter supplies the real store and Date.now().
// Info flow: store + input (with explicit now) -> updated store entry -> allow/deny decision.

export type RateLimitStoreEntry = {
	count: number;
	windowStart: number;
};

export type RateLimitStore = Map<string, RateLimitStoreEntry>;

export type EvaluateRateLimitInput = {
	key: string;
	limit: number;
	windowMs: number;
	now: number;
};

export type RateLimitDecision = {
	allowed: boolean;
	remaining: number;
	resetAt: number;
};

export const evaluateRateLimit = (
	store: RateLimitStore,
	input: EvaluateRateLimitInput
): RateLimitDecision => {
	const existing = store.get(input.key);
	const windowExpired = !existing || input.now - existing.windowStart >= input.windowMs;
	const windowStart = windowExpired ? input.now : existing.windowStart;
	const currentCount = windowExpired ? 0 : existing.count;
	const resetAt = windowStart + input.windowMs;
	const allowed = currentCount < input.limit;
	const nextCount = allowed ? currentCount + 1 : currentCount;
	store.set(input.key, { count: nextCount, windowStart });
	return {
		allowed,
		remaining: Math.max(0, input.limit - nextCount),
		resetAt
	};
};
