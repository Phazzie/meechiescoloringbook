// Purpose: Mock RateLimitSeam behavior without relying on real wall-clock timing.
// Why: Allow route/pipeline logic to be unit-tested against both allow and deny paths deterministically.
// Info flow: tests -> mock -> fixtures.
import type { RateLimitError, RateLimitSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import { rateLimitExceededFixture } from './fixtures';
import { validateRateLimitConfig, validateRateLimitKey } from './validators';

type RateLimitScenario = 'sample' | 'fault';

const validationError = (err: unknown): RateLimitError => ({
	code: 'RATE_LIMIT_EXCEEDED',
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
				return { ok: false, error: validationError(err) };
			}

			if (scenario === 'fault') {
				return { ok: false, error: rateLimitExceededFixture };
			}

			const used = (counts.get(key) ?? 0) + 1;
			counts.set(key, used);
			return {
				ok: true,
				value: {
					remaining: Math.max(config.limit - used, 0),
					limit: config.limit,
					resetAt: config.windowMs
				}
			};
		}
	};
};
