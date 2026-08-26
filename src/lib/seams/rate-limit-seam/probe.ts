// Purpose: Define an explicitly manual, non-live RateLimitSeam probe entrypoint.
// Why: Real Upstash behavior needs disposable credentials and must never run during tests/imports.
// Info flow: operator-provided seam/input -> one manual consume -> secret-free Result.
import type { RateLimitConsumeInput, RateLimitSeam } from './contract';

export const RATE_LIMIT_PROBE_STATUS = {
	live: false,
	reason: 'Requires separately authorized disposable Upstash credentials.'
} as const;

export const probeRateLimitSeam = (
	seam: RateLimitSeam,
	input: RateLimitConsumeInput
) => seam.consume(input);
