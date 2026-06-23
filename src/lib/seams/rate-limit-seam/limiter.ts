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
//
// Each stored timestamp is clamped to nowMs before the window check. A hit can never be dropped
// just because the clock stepped backward (clamping only lowers a timestamp, and a timestamp at
// nowMs itself always satisfies `> nowMs - windowMs`), so a backward clock step still can't be
// used to evade the limit. But without the clamp, a stale future-dated timestamp left over from
// before a large backward correction (e.g. an NTP resync) would keep being counted as "recent"
// until nowMs caught back up to it, inflating resetAtMs far past the intended window; clamping
// bounds resetAtMs to at most nowMs + windowMs in every case.
const pruneExpired = (hitTimestampsMs: number[], windowStartMs: number, nowMs: number): number[] =>
	hitTimestampsMs.map((timestampMs) => Math.min(timestampMs, nowMs)).filter((timestampMs) => timestampMs > windowStartMs);

export type KeyState = { hitTimestampsMs: number[]; windowMs: number };

// Keys whose hits all expired are dropped outright (not just pruned to an empty array), so a
// client/key that never returns doesn't sit in the map forever. windowMs is stored per key
// because it's the only way to know when an otherwise-untouched key's entries have expired.
// Exported for direct unit testing of the eviction behavior; not part of the RateLimitSeam contract.
export const sweepIdleKeys = (stateByKey: Map<string, KeyState>, nowMs: number): void => {
	for (const [key, state] of stateByKey) {
		const prunedHits = pruneExpired(state.hitTimestampsMs, nowMs - state.windowMs, nowMs);
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
			// nowMs < lastSweepMs covers backward clock adjustments (e.g. NTP sync); without it,
			// a clock step back would block all future sweeps until the clock caught back up.
			if (nowMs - lastSweepMs >= SWEEP_INTERVAL_MS || nowMs < lastSweepMs) {
				sweepIdleKeys(stateByKey, nowMs);
				lastSweepMs = nowMs;
			}

			const windowStartMs = nowMs - windowMs;
			const recentHits = pruneExpired(stateByKey.get(key)?.hitTimestampsMs ?? [], windowStartMs, nowMs);

			if (recentHits.length >= limit) {
				stateByKey.set(key, { hitTimestampsMs: recentHits, windowMs });
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: `Rate limit of ${limit} requests per ${windowMs}ms exceeded.`,
						resetAtMs: Math.min(...recentHits) + windowMs
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
					resetAtMs: Math.min(...recentHits) + windowMs
				}
			};
		}
	};
};
