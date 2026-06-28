// Purpose: Implement the deterministic RateLimitSeam sliding-window limiter.
// Why: Bound per-key request volume without relying on an internal clock, keeping the seam pure and testable.
// Info flow: route -> guard -> seam.check({ key, limit, windowMs, now }) -> allow/deny decision.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_KEYS = 10_000;

export const createRateLimitSeam = (): RateLimitSeam => {
  const hits = new Map<string, number[]>();
  let lastCleanup = 0;

  const pruneExpiredKeys = (now: number, windowMs: number) => {
    for (const [otherKey, timestamps] of hits) {
      const active = timestamps.filter((timestamp) => timestamp > now - windowMs);
      if (active.length === 0) {
        hits.delete(otherKey);
      } else {
        hits.set(otherKey, active);
      }
    }
    lastCleanup = now;
  };

  return {
    check: ({ key, limit, windowMs, now }: RateLimitCheckInput): RateLimitResult => {
      if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
        pruneExpiredKeys(now, windowMs);
      }

      if (!hits.has(key) && hits.size >= MAX_KEYS) {
        pruneExpiredKeys(now, windowMs);
        if (!hits.has(key) && hits.size >= MAX_KEYS) {
          const oldestKey = hits.keys().next().value;
          if (oldestKey !== undefined) {
            hits.delete(oldestKey);
          }
        }
      }

      const windowStart = now - windowMs;
      const inWindow = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

      if (inWindow.length >= limit) {
        hits.set(key, inWindow);
        const oldest = inWindow[0] ?? now;
        return { allowed: false, remaining: 0, retryAfterMs: Math.max(oldest + windowMs - now, 1) };
      }

      inWindow.push(now);
      hits.set(key, inWindow);
      return { allowed: true, remaining: limit - inWindow.length };
    }
  };
};
