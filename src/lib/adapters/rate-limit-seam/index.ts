// Purpose: Implement RateLimitSeam using an in-memory sliding-window counter.
// Why: Bound calls to paid AI-provider-backed endpoints per client without adding new
//      external infrastructure; state lives per warm serverless instance.
// Info flow: route call -> in-memory Map<key, timestamps[]> -> pure evaluate() -> Result<>.
import type { RateLimitRule, RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import { validateRateLimitRule } from '../../seams/rate-limit-seam/validators';
import { evaluate } from '../../seams/rate-limit-seam/window';

// Hard-bounds how many distinct keys (client addresses) the in-memory store holds at once.
// Without this, a client that never returns after its window expires would keep its
// entry forever, letting the Map grow unbounded across the life of a warm instance.
// The bound is enforced two ways: an opportunistic sweep drops keys whose entire timestamp
// history has expired (the common case), and if a genuinely new key would still push the
// store over the cap after that sweep (e.g. more than MAX_TRACKED_KEYS distinct clients are
// all active within the same window), the single oldest-inserted entry is evicted so store
// size can never exceed the cap, even under sustained high-cardinality traffic.
const DEFAULT_MAX_TRACKED_KEYS = 10_000;

// maxTrackedKeys is overridable (default 10_000) so tests can prove the hard-cap/eviction
// behavior deterministically with a tiny cap instead of looping tens of thousands of times.
export const createRateLimitSeam = (
	rawRule: RateLimitRule,
	maxTrackedKeys: number = DEFAULT_MAX_TRACKED_KEYS
): RateLimitSeam => {
	const rule = validateRateLimitRule(rawRule);
	const store = new Map<string, number[]>();

	const pruneExpiredKeys = (now: number) => {
		for (const [trackedKey, timestamps] of store) {
			const stillActive = timestamps.some((timestamp) => now - timestamp < rule.windowMs);
			if (!stillActive) store.delete(trackedKey);
		}
	};

	const evictOldestEntry = () => {
		const oldestKey = store.keys().next().value;
		if (oldestKey !== undefined) store.delete(oldestKey);
	};

	return {
		checkAndConsume: (key, now) => {
			const isNewKey = !store.has(key);
			if (isNewKey && store.size >= maxTrackedKeys) {
				pruneExpiredKeys(now);
			}

			const { result, nextTimestamps } = evaluate(store.get(key) ?? [], rule, now);
			if (nextTimestamps.length === 0) {
				store.delete(key);
			} else {
				if (isNewKey && store.size >= maxTrackedKeys) {
					evictOldestEntry();
				}
				store.set(key, nextTimestamps);
			}
			return result;
		}
	};
};
