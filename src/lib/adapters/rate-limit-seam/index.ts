// Purpose: Implement RateLimitSeam using an in-memory sliding-window counter.
// Why: Bound calls to paid AI-provider-backed endpoints per client without adding new
//      external infrastructure; state lives per warm serverless instance.
// Info flow: route call -> in-memory Map<key, timestamps[]> -> pure evaluate() -> Result<>.
import type { RateLimitRule, RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import { validateRateLimitRule } from '../../seams/rate-limit-seam/validators';
import { evaluate } from '../../seams/rate-limit-seam/window';

// Bounds how many distinct keys (client addresses) the in-memory store holds at once.
// Without this, a client that never returns after its window expires would keep its
// entry forever, letting the Map grow unbounded across the life of a warm instance.
const MAX_TRACKED_KEYS = 10_000;

export const createRateLimitSeam = (rawRule: RateLimitRule): RateLimitSeam => {
	const rule = validateRateLimitRule(rawRule);
	const store = new Map<string, number[]>();

	const pruneExpiredKeys = (now: number) => {
		for (const [trackedKey, timestamps] of store) {
			const stillActive = timestamps.some((timestamp) => now - timestamp < rule.windowMs);
			if (!stillActive) store.delete(trackedKey);
		}
	};

	return {
		checkAndConsume: (key, now) => {
			if (store.size >= MAX_TRACKED_KEYS && !store.has(key)) {
				pruneExpiredKeys(now);
			}

			const { result, nextTimestamps } = evaluate(store.get(key) ?? [], rule, now);
			if (nextTimestamps.length === 0) {
				store.delete(key);
			} else {
				store.set(key, nextTimestamps);
			}
			return result;
		}
	};
};
