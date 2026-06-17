// Purpose: Verify enforceRateLimit wires RateLimitSeam into route-shaped 429 responses.
// Why: This is the only consumer of RateLimitSeam in the request path; its 429 shape, headers,
//      and getClientAddress() fallback aren't covered by the seam's own contract tests.
// Info flow: fake client event -> enforceRateLimit -> pass-through or 429 Response.
import { describe, expect, it } from 'vitest';
import { enforceRateLimit, type RateLimitClientEvent } from '../../src/lib/server/rate-limit-guard';

const buildEvent = (address: string): RateLimitClientEvent => ({
	getClientAddress: () => address
});

const throwingEvent: RateLimitClientEvent = {
	getClientAddress: () => {
		throw new Error('not available in this runtime');
	}
};

describe('enforceRateLimit', () => {
	it('allows requests under the route limit', () => {
		const event = buildEvent('203.0.113.1');
		const result = enforceRateLimit('chat-interpretation', event);
		expect(result.ok).toBe(true);
	});

	it('blocks once a route limit is exceeded and returns a 429 with Retry-After', async () => {
		const event = buildEvent('203.0.113.2');
		for (let i = 0; i < 10; i += 1) {
			expect(enforceRateLimit('generate', event).ok).toBe(true);
		}

		const blocked = enforceRateLimit('generate', event);

		expect(blocked.ok).toBe(false);
		if (blocked.ok) return;
		expect(blocked.response.status).toBe(429);
		expect(blocked.response.headers.get('Retry-After')).not.toBeNull();
		const payload = await blocked.response.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
		expect(typeof payload.error.details.retryAfterSeconds).toBe('string');
	});

	it('tracks independent budgets per route for the same client', () => {
		const event = buildEvent('203.0.113.3');
		for (let i = 0; i < 10; i += 1) {
			expect(enforceRateLimit('image-generation', event).ok).toBe(true);
		}
		expect(enforceRateLimit('image-generation', event).ok).toBe(false);

		// Different route, same client: independent budget should still allow this request.
		expect(enforceRateLimit('wig-try-on', event).ok).toBe(true);
	});

	it('falls back to a shared "unknown" bucket when getClientAddress throws', () => {
		const result = enforceRateLimit('meechie-studio-text', throwingEvent);
		expect(result.ok).toBe(true);
	});

	it('enforces a budget on the tools route', () => {
		const event = buildEvent('203.0.113.4');
		for (let i = 0; i < 30; i += 1) {
			expect(enforceRateLimit('tools', event).ok).toBe(true);
		}
		expect(enforceRateLimit('tools', event).ok).toBe(false);
	});
});
