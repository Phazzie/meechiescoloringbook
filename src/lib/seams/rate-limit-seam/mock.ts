// Purpose: Mock RateLimitSeam behavior without relying on real wall-clock timing.
// Why: Allow route/pipeline logic to be unit-tested against both allow and deny paths deterministically.
// Info flow: tests -> mock -> fixtures.
import type { RateLimitError, RateLimitSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import { rateLimitExceededFixture } from './fixtures';
import { validateRateLimitConfig, validateRateLimitKey } from './validators';

type RateLimitScenario = 'sample' | 'fault';

const configInvalidError = (err: unknown): RateLimitError => ({
	code: 'RATE_LIMIT_CONFIG_INVALID',
	message: err instanceof Error ? err.message : 'Rate limit input validation failed.',
	retryAfterMs: 0
});

export const createMockRateLimitSeam = (scenario: RateLimitScenario = 'sample'): RateLimitSeam => {
	const counts = new Map<string, number>();

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

			const used = (counts.get(key) ?? 0) + 1;
			const resetAt = Date.now() + config.windowMs;

			if (used > config.limit) {
				return {
					ok: false,
					error: {
						code: 'RATE_LIMIT_EXCEEDED',
						message: 'Too many requests. Please slow down and try again shortly.',
						retryAfterMs: config.windowMs
					}
				};
			}

			counts.set(key, used);
			return {
				ok: true,
				value: {
					remaining: config.limit - used,
					limit: config.limit,
					resetAt
				}
			};
		}
	};
};
