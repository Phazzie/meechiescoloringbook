// Purpose: Implement the deterministic RateLimitSeam sliding-window limiter.
// Why: Protect metered external AI-provider calls from per-client abuse without requiring
//      an external store; the caller injects the clock so behavior stays pure and testable.
// Info flow: route handler -> checkAndConsume({key, limit, windowMs, nowMs}) -> RateLimitResult.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';
import { validateRateLimitCheckInput } from './validators';

// State is held in this closure's Map, so each createRateLimitSeam() instance has its own
// independent, per-process budget. On a serverless platform (Vercel) each function instance
// gets its own Map, so this limits abuse per-instance, not globally across every instance
// that might handle requests for the same key. See DECISIONS.md 2026-06-17 Assumption entry.
export const pruneExpired = (hitTimestampsMs: number[], windowStartMs: number): number[] =>
	hitTimestampsMs.filter((timestampMs) => timestampMs > windowStartMs);

// Without this, hitsByKey only grows: a key whose client never returns keeps its (eventually
// all-expired) array forever. Every call sweeps the whole map and drops keys with no hits left
// in the window, so idle high-cardinality keys (e.g. one-off client IPs) don't accumulate
// unboundedly over a long-lived serverless instance.
export const evictExpiredKeys = (hitsByKey: Map<string, number[]>, windowStartMs: number): void => {
	for (const [key, hits] of hitsByKey) {
		const remaining = pruneExpired(hits, windowStartMs);
		if (remaining.length === 0) {
			hitsByKey.delete(key);
		} else if (remaining.length !== hits.length) {
			hitsByKey.set(key, remaining);
		}
	}
};

// Throttling the sweep instead of running it on every call keeps the common-case cost at the
// single matched key's prune (the eviction itself is still correctness-neutral: a key's own
// budget is always pruned on the call that touches it, regardless of when the last sweep ran).
const EVICTION_SWEEP_INTERVAL_MS = 10_000;

export const createRateLimitSeam = (): RateLimitSeam => {
	const hitsByKey = new Map<string, number[]>();
	let lastSweepMs = -Infinity;

	return {
		checkAndConsume: (rawInput): RateLimitResult => {
			let input: RateLimitCheckInput;
			try {
				input = validateRateLimitCheckInput(rawInput);
			} catch (err) {
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_INPUT_INVALID',
						message: err instanceof Error ? err.message : 'Invalid rate limit input.'
					}
				};
			}

			const { key, limit, windowMs, nowMs } = input;
			const windowStartMs = nowMs - windowMs;
			if (nowMs - lastSweepMs > EVICTION_SWEEP_INTERVAL_MS) {
				evictExpiredKeys(hitsByKey, windowStartMs);
				lastSweepMs = nowMs;
			}
			const recentHits = pruneExpired(hitsByKey.get(key) ?? [], windowStartMs);

			if (recentHits.length >= limit) {
				hitsByKey.set(key, recentHits);
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: `Rate limit of ${limit} requests per ${windowMs}ms exceeded.`,
						resetAtMs: recentHits[0] + windowMs
					}
				};
			}

			recentHits.push(nowMs);
			hitsByKey.set(key, recentHits);
			return {
				ok: true,
				value: {
					limit,
					remaining: limit - recentHits.length,
					resetAtMs: recentHits[0] + windowMs
				}
			};
		}
	};
};
