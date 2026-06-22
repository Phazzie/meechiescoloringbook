// Purpose: Implement the deterministic RateLimitSeam sliding-window limiter.
// Why: Protect metered external AI-provider calls from per-client abuse without requiring
//      an external store; the caller injects the clock so behavior stays pure and testable.
// Info flow: route handler -> checkAndConsume({key, limit, windowMs, nowMs}) -> RateLimitResult.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';
import { validateRateLimitCheckInput } from './validators';

// State is held in this closure's Map, so each createRateLimitSeam() instance has its own
// independent, per-process budget. On a serverless platform (Vercel) each function instance
// gets its own Map, so this limits abuse per-instance, not globally across every instance
// that might handle requests for the same key.
const pruneExpired = (hitTimestampsMs: number[], windowStartMs: number): number[] =>
	hitTimestampsMs.filter((timestampMs) => timestampMs > windowStartMs);

export type KeyState = { hitTimestampsMs: number[]; windowMs: number };

// Keys whose hits all expired are dropped outright (not just pruned to an empty array), so a
// client/key that never returns doesn't sit in the map forever. windowMs is stored per key
// because it's the only way to know when an otherwise-untouched key's entries have expired.
// Exported for direct unit testing of the eviction behavior; not part of the RateLimitSeam contract.
export const sweepIdleKeys = (stateByKey: Map<string, KeyState>, nowMs: number): void => {
	for (const [key, state] of stateByKey) {
		const prunedHits = pruneExpired(state.hitTimestampsMs, nowMs - state.windowMs);
		if (prunedHits.length === 0) {
			stateByKey.delete(key);
		} else if (prunedHits.length !== state.hitTimestampsMs.length) {
			stateByKey.set(key, { hitTimestampsMs: prunedHits, windowMs: state.windowMs });
		}
	}
};

// Sweeping every key on every call is O(N) per request; throttling it to once per interval
// keeps the amortized cost O(1) while still reclaiming idle keys promptly enough in practice.
const SWEEP_INTERVAL_MS = 60_000;

export const createRateLimitSeam = (): RateLimitSeam => {
	const stateByKey = new Map<string, KeyState>();
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
			if (nowMs - lastSweepMs >= SWEEP_INTERVAL_MS) {
				sweepIdleKeys(stateByKey, nowMs);
				lastSweepMs = nowMs;
			}

			const windowStartMs = nowMs - windowMs;
			const recentHits = pruneExpired(stateByKey.get(key)?.hitTimestampsMs ?? [], windowStartMs);

			if (recentHits.length >= limit) {
				stateByKey.set(key, { hitTimestampsMs: recentHits, windowMs });
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
			stateByKey.set(key, { hitTimestampsMs: recentHits, windowMs });
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
