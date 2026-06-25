// Purpose: Contract tests for RateLimitConfigSeam.
// Why: Enforce mock adherence to the seam contract; red proof that fault fixture fails validation.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { createRateLimitConfigSeam } from '../../adapters/rate-limit-config-seam';
import { rateLimitConfigFaultFixture, rateLimitConfigFixture } from './fixtures';
import { createMockRateLimitConfigSeam } from './mock';
import { validateRateLimitConfig } from './validators';

describe('RateLimitConfigSeam mock contract', () => {
	it('returns a validated config on the sample scenario', () => {
		const seam = createMockRateLimitConfigSeam('sample');
		const config = seam.getConfig();
		expect(config).toEqual(rateLimitConfigFixture);
		expect(validateRateLimitConfig(config)).toEqual(rateLimitConfigFixture);
	});

	it('fault fixture fails validation (red proof)', () => {
		const seam = createMockRateLimitConfigSeam('fault');
		const config = seam.getConfig();
		expect(config).toEqual(rateLimitConfigFaultFixture);
		expect(() => validateRateLimitConfig(config)).toThrow();
	});

	it('config contains only the two rate-limit keys', () => {
		const seam = createMockRateLimitConfigSeam('sample');
		const config = seam.getConfig();
		expect(Object.keys(config).sort()).toEqual(
			['rateLimitMaxRequests', 'rateLimitWindowMs'].sort()
		);
	});

	it('uses documented defaults when rate-limit env values are absent', () => {
		const seam = createRateLimitConfigSeam({});
		expect(seam.getConfig()).toEqual({
			rateLimitMaxRequests: 20,
			rateLimitWindowMs: 60_000
		});
	});

	it('reads valid env overrides', () => {
		const seam = createRateLimitConfigSeam({
			RATE_LIMIT_MAX_REQUESTS: '5',
			RATE_LIMIT_WINDOW_MS: '30000'
		});
		expect(seam.getConfig()).toEqual({
			rateLimitMaxRequests: 5,
			rateLimitWindowMs: 30_000
		});
	});

	it('falls back to defaults instead of throwing on out-of-range env values', () => {
		const seam = createRateLimitConfigSeam({ RATE_LIMIT_MAX_REQUESTS: '99999' });
		expect(() => seam.getConfig()).not.toThrow();
		expect(seam.getConfig()).toEqual({
			rateLimitMaxRequests: 20,
			rateLimitWindowMs: 60_000
		});
	});

	it('keeps a valid field when its sibling field is invalid', () => {
		const seam = createRateLimitConfigSeam({
			RATE_LIMIT_MAX_REQUESTS: '99999',
			RATE_LIMIT_WINDOW_MS: '30000'
		});
		expect(seam.getConfig()).toEqual({ rateLimitMaxRequests: 20, rateLimitWindowMs: 30_000 });
	});

	it('treats a negative env value as unset and falls back to the default', () => {
		const seam = createRateLimitConfigSeam({ RATE_LIMIT_MAX_REQUESTS: '-5' });
		expect(seam.getConfig()).toEqual({ rateLimitMaxRequests: 20, rateLimitWindowMs: 60_000 });
	});
});
