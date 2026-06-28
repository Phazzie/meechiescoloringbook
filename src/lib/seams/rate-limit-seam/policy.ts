// Purpose: Implement the deterministic RateLimitSeam sliding-window limiter.
// Why: Bound per-key request volume without relying on an internal clock, keeping the seam pure and testable.
// Info flow: route -> guard -> seam.check({ key, limit, windowMs, now }) -> allow/deny decision.
import type { RateLimitCheckInput, RateLimitResult, RateLimitSeam } from './contract';

export const createRateLimitSeam = (): RateLimitSeam => {
  const hits = new Map<string, number[]>();

  return {
    check: ({ key, limit, windowMs, now }: RateLimitCheckInput): RateLimitResult => {
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
