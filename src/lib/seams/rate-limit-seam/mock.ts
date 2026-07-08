// Purpose: Mock RateLimitSeam behavior without relying on real wall-clock timing.
// Why: Allow route/pipeline logic to be unit-tested against both allow and deny paths deterministically.
// Info flow: tests -> mock -> fixtures.
import type { RateLimitError, RateLimitSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import { rateLimitExceededFixture } from './fixtures';
import { validateRateLimitConfig, validateRateLimitKey } from './validators';

type RateLimitScenario = 'sample' | 'fault';
type Window = { start: number; count: number };

const configInvalidError = (err: unknown): RateLimitError => ({
	code: 'RATE_LIMIT_CONFIG_INVALID',
	message: err instanceof Error ? err.message : 'Rate limit input validation failed.',
	retryAfterMs: 0
});

// Mirrors the adapter's fixed-window algorithm (minus pruning, which a test-scoped mock
// doesn't need) so mock behavior — including window reset after windowMs elapses — matches
// what the real adapter does, instead of denying a key forever once it hits its limit.
export const createMockRateLimitSeam = (
	scenario: RateLimitScenario = 'sample',
	now: () => number = Date.now
): RateLimitSeam => {
	const windows = new Map<string, Window>();

	return {
		consume: (key, config): Result<{ remaining: number; limit: number; resetAt: number }, RateLimitError> => {
			try {
				validateRateLimitKey(key);
				validateRateLimitConfig(config);
			} catch (err) {
				return { ok: false, error: configInvalidError(err) };
			}

			if (scenario === 'fault') {
				return { ok: false, error: rateLimitExceededFixture };
			}

			const nowMs = now();
			const existing = windows.get(key);
			const windowStart =
				existing && nowMs - existing.start < config.windowMs ? existing.start : nowMs;
			const count = windowStart === existing?.start ? existing.count : 0;
			const resetAt = windowStart + config.windowMs;

			if (count >= config.limit) {
				windows.set(key, { start: windowStart, count });
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Too many requests. Please slow down and try again shortly.',
						retryAfterMs: Math.max(resetAt - nowMs, 0)
					}
				};
			}

			const nextCount = count + 1;
			windows.set(key, { start: windowStart, count: nextCount });
			return {
				ok: true,
				value: {
					remaining: config.limit - nextCount,
					limit: config.limit,
					resetAt
				}
			};
		}
	};
};
