// Purpose: Pure fixed-window rate limit evaluation over an injected in-memory store.
// Why: Keep the counting algorithm deterministic and testable independent of the real clock;
//      only the adapter supplies the real store and Date.now(). The store is bounded so a
//      long-lived process (or an attacker spraying unique client keys) cannot grow it forever.
// Info flow: store + input (with explicit now) -> updated store entry -> allow/deny decision.

export type RateLimitStoreEntry = {
	count: number;
	windowStart: number;
	windowMs: number;
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

// Hard cap on distinct tracked keys. Once the store is at capacity and a brand-new key needs
// tracking, an existing entry must be evicted first: an already-expired entry is preferred
// (cheapest, keeps still-active clients tracked), falling back to FIFO eviction of the
// oldest-inserted key so worst-case memory stays bounded even under sustained, fully-active,
// high-cardinality traffic.
export const MAX_RATE_LIMIT_STORE_ENTRIES = 5000;

const isExpired = (entry: RateLimitStoreEntry, now: number) => now - entry.windowStart >= entry.windowMs;

const makeRoomForNewKey = (store: RateLimitStore, now: number): void => {
	if (store.size < MAX_RATE_LIMIT_STORE_ENTRIES) {
		return;
	}
	for (const [key, entry] of store) {
		if (isExpired(entry, now)) {
			store.delete(key);
			return;
		}
	}
	const oldestKey = store.keys().next().value;
	if (oldestKey !== undefined) {
		store.delete(oldestKey);
	}
};

export const evaluateRateLimit = (
	store: RateLimitStore,
	input: EvaluateRateLimitInput
): RateLimitDecision => {
	const existing = store.get(input.key);
	const windowExpired = !existing || isExpired(existing, input.now);
	const windowStart = windowExpired ? input.now : existing.windowStart;
	const currentCount = windowExpired ? 0 : existing.count;
	const resetAt = windowStart + input.windowMs;
	const allowed = currentCount < input.limit;
	const nextCount = allowed ? currentCount + 1 : currentCount;

	if (!store.has(input.key)) {
		makeRoomForNewKey(store, input.now);
	}
	store.set(input.key, { count: nextCount, windowStart, windowMs: input.windowMs });

	return {
		allowed,
		remaining: Math.max(0, input.limit - nextCount),
		resetAt
	};
};
