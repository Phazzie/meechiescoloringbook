// Purpose: Unit tests for the shared enforceRateLimit route guard.
// Why: Lock the 429 + Retry-After response shape and the fail-open behavior on seam errors.
// Info flow: fake RateLimitSeam -> enforceRateLimit -> Response or null.
import { describe, expect, it } from 'vitest';
import type { RateLimitSeam } from '../../src/lib/seams/rate-limit-seam/contract';
import { enforceRateLimit } from '../../src/lib/server/rate-limit-guard';

const config = { limit: 1, windowMs: 60_000 };

describe('enforceRateLimit', () => {
	it('returns null (continue) when the seam allows the request', () => {
		const seam: RateLimitSeam = {
			checkLimit: () => ({ ok: true, value: { allowed: true, remaining: 0, resetAt: Date.now() + 1000 } })
		};
		expect(enforceRateLimit(seam, '1.2.3.4', 'generate', config)).toBeNull();
	});

	it('returns a 429 response with a Retry-After header when denied', async () => {
		const resetAt = Date.now() + 5000;
		const seam: RateLimitSeam = {
			checkLimit: () => ({ ok: true, value: { allowed: false, remaining: 0, resetAt } })
		};
		const response = enforceRateLimit(seam, '1.2.3.4', 'generate', config);
		expect(response).not.toBeNull();
		expect(response?.status).toBe(429);
		expect(Number(response?.headers.get('Retry-After'))).toBeGreaterThan(0);
		const payload = await response?.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
	});

	it('fails open (returns null) when the seam reports an input error', () => {
		const seam: RateLimitSeam = {
			checkLimit: () => ({
				ok: false,
				error: { code: 'RATE_LIMIT_INVALID_INPUT', message: 'bad input' }
			})
		};
		expect(enforceRateLimit(seam, '1.2.3.4', 'generate', config)).toBeNull();
	});

	it('scopes the seam key by route name and client address', () => {
		const calls: string[] = [];
		const seam: RateLimitSeam = {
			checkLimit: (input) => {
				calls.push(input.key);
				return { ok: true, value: { allowed: true, remaining: 0, resetAt: 0 } };
			}
		};
		enforceRateLimit(seam, '9.9.9.9', 'wig-try-on', config);
		expect(calls).toEqual(['wig-try-on:9.9.9.9']);
	});
});
