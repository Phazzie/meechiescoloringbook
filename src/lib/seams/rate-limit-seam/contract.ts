// Purpose: Define RateLimitSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> policy/mock/tests -> rate-limit-guard.
export type RateLimitCheckInput = {
  key: string;
  limit: number;
  windowMs: number;
  now: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterMs: number };

export type RateLimitSeam = {
  check: (input: RateLimitCheckInput) => RateLimitResult;
};
