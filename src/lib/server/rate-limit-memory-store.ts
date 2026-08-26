// Purpose: Provide the degraded in-process fixed-window RateLimitSeam used when no durable store is configured.
// Why: A deployment without Upstash must still meter every billable call instead of 503-ing every request or opening a fail-open hole.
// Info flow: validated consume input + injected clock -> per-process (identity, bucket, window) counter -> validated quota decision.
//
// Contract notes for callers (six route tickets depend on these):
// - This seam is weaker than the durable one in exactly one way: its window is per process, so N
//   serverless instances allow at most N x limit. It is never a bypass; every call is still metered.
// - The seam MUST be a process-wide singleton (use getMemoryRateLimitSeam). Building a fresh instance
//   per request would reset the window on every call and silently disable rate limiting.
// - Degraded identities are HMAC'd with a random per-process secret, so they stay pseudonymous and are
//   deliberately not linkable across restarts or across instances.
// - The map is bounded. Once MEMORY_RATE_LIMIT_MAX_TRACKED_KEYS live counters exist, previously unseen
//   keys get a store error (the guard turns that into 503) while known callers keep metering. That is
//   fail-closed by design; it must never be relaxed into "allow when full".
import { randomBytes } from 'node:crypto';
import type {
	RateLimitError,
	RateLimitSeam
} from '$lib/seams/rate-limit-seam/contract';
import {
	validateRateLimitConsumeInput,
	validateRateLimitDecision
} from '$lib/seams/rate-limit-seam/validators';

/** Upper bound on live fixed-window counters held by one process. */
export const MEMORY_RATE_LIMIT_MAX_TRACKED_KEYS = 10_000;

export type MemoryRateLimitSeam = RateLimitSeam & {
	/** Live counter count. Diagnostics and eviction tests only; never part of a response. */
	trackedKeyCount: () => number;
};

export type MemoryRateLimitStoreDependencies = {
	now?: () => number;
	maxTrackedKeys?: number;
};

type ConsumeResult = Awaited<ReturnType<RateLimitSeam['consume']>>;

type WindowCounter = {
	used: number;
	resetAtMs: number;
};

// Generated once per process at module load. Never a constant and never an environment
// fallback: a fixed value would make degraded identities linkable across restarts and deployments.
const PROCESS_IDENTITY_SECRET = randomBytes(32).toString('hex');

/** Ephemeral identity secret for degraded mode. Stable inside one process, random across processes. */
export const memoryRateLimitIdentitySecret = (): string => PROCESS_IDENTITY_SECRET;

const errorResult = (
	code: RateLimitError['code'],
	message: string
): ConsumeResult => ({
	ok: false,
	error: { code, message } as RateLimitError
});

export const createMemoryRateLimitSeam = (
	dependencies: MemoryRateLimitStoreDependencies = {}
): MemoryRateLimitSeam => {
	const now = dependencies.now ?? Date.now;
	const maxTrackedKeys =
		dependencies.maxTrackedKeys ?? MEMORY_RATE_LIMIT_MAX_TRACKED_KEYS;
	const windows = new Map<string, WindowCounter>();
	// Earliest reset among live counters. Until that instant no counter can be expired,
	// so the sweep stays O(1) per request and runs O(n) once per window.
	let nextSweepAtMs = Number.POSITIVE_INFINITY;

	const evictExpired = (nowMs: number): void => {
		let earliestResetAtMs = Number.POSITIVE_INFINITY;
		for (const [key, counter] of windows) {
			if (counter.resetAtMs <= nowMs) {
				windows.delete(key);
				continue;
			}
			if (counter.resetAtMs < earliestResetAtMs) {
				earliestResetAtMs = counter.resetAtMs;
			}
		}
		nextSweepAtMs = earliestResetAtMs;
	};

	return {
		trackedKeyCount: () => windows.size,
		// Read-modify-write runs to completion with no await, so concurrent requests on one
		// event loop cannot interleave and lose an increment.
		consume: async (input) => {
			let validated;
			try {
				validated = validateRateLimitConsumeInput(input);
			} catch {
				return errorResult(
					'RATE_LIMIT_VALIDATION_ERROR',
					'Rate limit operation failed validation.'
				);
			}

			const nowMs = Math.max(0, Math.floor(now()));
			const windowStartMs =
				Math.floor(nowMs / validated.windowMs) * validated.windowMs;
			const resetAtMs = windowStartMs + validated.windowMs;
			const storageKey = [
				'meechie',
				'rate-limit',
				validated.bucket,
				String(windowStartMs),
				validated.identityKey
			].join(':');

			if (nowMs >= nextSweepAtMs) evictExpired(nowMs);

			const counter = windows.get(storageKey);
			if (!counter && windows.size >= maxTrackedKeys) {
				return errorResult(
					'RATE_LIMIT_STORE_ERROR',
					'Rate limit storage is unavailable.'
				);
			}

			const used = (counter?.used ?? 0) + validated.cost;
			windows.set(storageKey, { used, resetAtMs });
			if (resetAtMs < nextSweepAtMs) nextSweepAtMs = resetAtMs;

			try {
				return {
					ok: true,
					value: validateRateLimitDecision({
						allowed: used <= validated.limit,
						limit: validated.limit,
						used,
						remaining: Math.max(validated.limit - used, 0),
						resetAtMs
					})
				};
			} catch {
				return errorResult(
					'RATE_LIMIT_STORE_ERROR',
					'Rate limit storage is unavailable.'
				);
			}
		}
	};
};

let sharedMemorySeam: MemoryRateLimitSeam | null = null;

/** Process-wide degraded seam. Counters must outlive a single request to mean anything. */
export const getMemoryRateLimitSeam = (): MemoryRateLimitSeam => {
	sharedMemorySeam ??= createMemoryRateLimitSeam();
	return sharedMemorySeam;
};
