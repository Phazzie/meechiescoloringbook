// Purpose: Unit tests for the SvelteKit quota gate that fronts every billable route.
// Why: A gate that forgets event.getClientAddress collapses the whole internet into one shared bucket while every other test stays green.
// Info flow: fake RequestEvent + guard/seam doubles -> createQuotaGate -> HTTP-ready quota decision.
import { describe, expect, it, vi } from 'vitest';
import type { RateLimitSeam } from '../../src/lib/seams/rate-limit-seam/contract';
import type { RateLimitConfig } from '../../src/lib/server/rate-limit-config';
import {
	createRateLimitGuard,
	type RateLimitGuardInput,
	type RateLimitGuardResult
} from '../../src/lib/server/rate-limit-guard';
import { resolveRateLimitIdentity } from '../../src/lib/server/rate-limit-identity';
import { createMemoryRateLimitSeam } from '../../src/lib/server/rate-limit-memory-store';
import { createQuotaGate } from '../../src/lib/server/rate-limit-route';

const CONFIG: RateLimitConfig = {
	upstashRestUrl: 'https://fixture-upstash.example',
	upstashRestToken: 'fixture-store-token',
	identitySecret: 'fixture-identity-secret',
	operationTimeoutMs: 1_500
};

const CLIENT_ADDRESS = '203.0.113.7';
const OTHER_CLIENT_ADDRESS = '198.51.100.23';

const fakeEvent = (getClientAddress: () => string) => ({ getClientAddress });

const stubGuard = (result: RateLimitGuardResult) =>
	vi.fn(async (_input: RateLimitGuardInput): Promise<RateLimitGuardResult> => result);

const seamReturning = (
	result: Awaited<ReturnType<RateLimitSeam['consume']>>
): RateLimitSeam => ({ consume: vi.fn().mockResolvedValue(result) });

/** Wraps a real guard so a test can inspect exactly what the gate handed it. */
const recordingGuard = (guard: ReturnType<typeof createRateLimitGuard>) => {
	const inputs: RateLimitGuardInput[] = [];
	const results: RateLimitGuardResult[] = [];
	const wrapped = async (input: RateLimitGuardInput) => {
		inputs.push(input);
		const result = await guard(input);
		results.push(result);
		return result;
	};
	return { wrapped, inputs, results };
};

/** Real guard over the degraded in-process store, frozen at window start. */
const degradedGuard = (nowMs = 0) =>
	createRateLimitGuard({
		readEnvironment: () => ({}),
		createMemorySeam: (() => {
			const seam = createMemoryRateLimitSeam({ now: () => nowMs });
			return () => seam;
		})(),
		now: () => nowMs
	});

describe('quota gate wiring', () => {
	const pseudonymousHarness = () => {
		const seam = seamReturning({
			ok: true,
			value: { allowed: true, limit: 20, used: 1, remaining: 19, resetAtMs: 60_000 }
		});
		const recorder = recordingGuard(
			createRateLimitGuard({
				loadConfig: () => CONFIG,
				createSeam: () => seam,
				now: () => 1_000
			})
		);
		const gate = createQuotaGate(
			fakeEvent(() => CLIENT_ADDRESS),
			'text',
			{ guard: recorder.wrapped }
		);
		return { seam, recorder, gate };
	};

	it('threads the real client address through to the guard', async () => {
		const { recorder, gate } = pseudonymousHarness();

		const decision = await gate(1);

		expect(decision.ok).toBe(true);
		expect(recorder.inputs).toHaveLength(1);
		expect(recorder.inputs[0]?.getClientAddress).toBeTypeOf('function');
		expect(recorder.inputs[0]?.getClientAddress?.()).toBe(CLIENT_ADDRESS);
	});

	it('resolves a pseudonymous identity, never the shared fallback bucket', async () => {
		const { seam, recorder, gate } = pseudonymousHarness();

		await gate(1);

		const observed = recorder.results[0];
		expect(observed?.ok === true && observed.identityKind).toBe('pseudonymous');
		expect(observed?.ok === true && observed.identityKind).not.toBe('fallback');

		const expectedKey = resolveRateLimitIdentity({
			identitySecret: CONFIG.identitySecret,
			getClientAddress: () => CLIENT_ADDRESS
		}).key;
		const sharedFallbackKey = resolveRateLimitIdentity({
			identitySecret: CONFIG.identitySecret
		}).key;
		expect(expectedKey).toMatch(/^rl:client:[a-f0-9]{64}$/);
		expect(seam.consume).toHaveBeenCalledWith(
			expect.objectContaining({ identityKey: expectedKey })
		);
		expect(seam.consume).not.toHaveBeenCalledWith(
			expect.objectContaining({ identityKey: sharedFallbackKey })
		);
	});

	it('keeps two different callers in two different buckets', async () => {
		const consumed: string[] = [];
		const seam: RateLimitSeam = {
			consume: vi.fn(async (input) => {
				consumed.push(input.identityKey);
				return {
					ok: true as const,
					value: {
						allowed: true,
						limit: 20,
						used: 1,
						remaining: 19,
						resetAtMs: 60_000
					}
				};
			})
		};
		const guard = createRateLimitGuard({
			loadConfig: () => CONFIG,
			createSeam: () => seam,
			now: () => 0
		});

		await createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'text', { guard })(1);
		await createQuotaGate(fakeEvent(() => OTHER_CLIENT_ADDRESS), 'text', { guard })(1);

		expect(consumed).toHaveLength(2);
		expect(consumed[0]).not.toBe(consumed[1]);
	});

	it('calls getClientAddress lazily, once per gate invocation', async () => {
		const getClientAddress = vi.fn(() => CLIENT_ADDRESS);
		const guard = stubGuard({
			ok: true,
			status: 200,
			headers: { 'Cache-Control': 'no-store' },
			identityKind: 'pseudonymous',
			store: 'durable',
			limit: 20,
			remaining: 19,
			resetAtMs: 60_000
		});
		const gate = createQuotaGate(fakeEvent(getClientAddress), 'text', { guard });

		expect(getClientAddress).not.toHaveBeenCalled();
		await gate(1);
		expect(guard.mock.calls[0]?.[0]?.getClientAddress?.()).toBe(CLIENT_ADDRESS);
	});
});

describe('quota gate decisions', () => {
	it('returns guard headers verbatim on an allowed decision', async () => {
		const headers = {
			'Cache-Control': 'no-store',
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '17',
			'RateLimit-Reset': '59',
			'X-Guard-Sentinel': 'verbatim'
		};
		const guard = stubGuard({
			ok: true,
			status: 200,
			headers,
			identityKind: 'pseudonymous',
			store: 'durable',
			limit: 20,
			remaining: 17,
			resetAtMs: 60_000
		});
		const gate = createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'text', { guard });

		const decision = await gate(3);

		expect(decision).toEqual({ ok: true, headers });
		expect(guard).toHaveBeenCalledTimes(1);
		expect(guard.mock.calls[0]?.[0]).toMatchObject({ bucket: 'text', cost: 3 });
	});

	it('forwards the requested bucket and cost without rewriting them', async () => {
		const guard = stubGuard({
			ok: true,
			status: 200,
			headers: { 'Cache-Control': 'no-store' },
			identityKind: 'pseudonymous',
			store: 'memory',
			limit: 8,
			remaining: 3,
			resetAtMs: 60_000
		});

		await createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'image', { guard })(5);

		expect(guard.mock.calls[0]?.[0]).toMatchObject({ bucket: 'image', cost: 5 });
	});

	it('denies with 429, the guard reset headers, and the shared route error body', async () => {
		const headers = {
			'Cache-Control': 'no-store',
			'RateLimit-Limit': '8',
			'RateLimit-Remaining': '0',
			'RateLimit-Reset': '60',
			'Retry-After': '60'
		};
		const guard = stubGuard({
			ok: false,
			status: 429,
			headers,
			error: {
				code: 'RATE_LIMITED',
				message: 'Too many requests. Try again after the current window resets.'
			}
		});
		const gate = createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'image', { guard });

		const decision = await gate(1);

		expect(decision).toEqual({
			ok: false,
			status: 429,
			headers,
			body: {
				ok: false,
				error: {
					code: 'RATE_LIMITED',
					message: 'Too many requests. Try again after the current window resets.'
				}
			}
		});
	});

	it('fails closed with 503 when the store fails', async () => {
		const guard = stubGuard({
			ok: false,
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
			error: {
				code: 'RATE_LIMIT_UNAVAILABLE',
				message: 'Rate limiting is temporarily unavailable.'
			}
		});
		const gate = createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'text', { guard });

		const decision = await gate(1);

		expect(decision).toEqual({
			ok: false,
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
			body: {
				ok: false,
				error: {
					code: 'RATE_LIMIT_UNAVAILABLE',
					message: 'Rate limiting is temporarily unavailable.'
				}
			}
		});
	});
});

describe('quota gate enforcement', () => {
	it('allows exactly the twentieth text call and denies the twenty-first', async () => {
		const gate = createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'text', {
			guard: degradedGuard()
		});

		const decisions = [];
		for (let call = 0; call < 21; call += 1) {
			decisions.push(await gate(1));
		}

		expect(decisions.slice(0, 20).every((decision) => decision.ok)).toBe(true);
		const denied = decisions[20];
		expect(denied?.ok).toBe(false);
		if (denied && !denied.ok) {
			expect(denied.status).toBe(429);
			expect(denied.headers['Retry-After']).toBe('60');
			expect(denied.headers['Cache-Control']).toBe('no-store');
			expect(denied.headers['RateLimit-Remaining']).toBe('0');
			expect(denied.body.error.code).toBe('RATE_LIMITED');
		}
	});

	it('allows exactly the eighth image call and denies the ninth', async () => {
		const gate = createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'image', {
			guard: degradedGuard()
		});

		const decisions = [];
		for (let call = 0; call < 9; call += 1) {
			decisions.push(await gate(1));
		}

		expect(decisions.slice(0, 8).every((decision) => decision.ok)).toBe(true);
		expect(decisions[8]?.ok).toBe(false);
	});

	it('still meters a caller whose address lookup throws instead of allowing by default', async () => {
		const throwingEvent = {
			getClientAddress: (): string => {
				throw new Error('client address unavailable');
			}
		};
		const seam = seamReturning({
			ok: true,
			value: { allowed: false, limit: 20, used: 21, remaining: 0, resetAtMs: 60_000 }
		});
		const recorder = recordingGuard(
			createRateLimitGuard({
				loadConfig: () => CONFIG,
				createSeam: () => seam,
				now: () => 0
			})
		);
		const gate = createQuotaGate(throwingEvent, 'text', { guard: recorder.wrapped });

		const decision = await gate(1);

		expect(decision.ok).toBe(false);
		if (!decision.ok) expect(decision.status).toBe(429);
		expect(seam.consume).toHaveBeenCalledWith(
			expect.objectContaining({
				identityKey: expect.stringMatching(/^rl:fallback:[a-f0-9]{64}$/)
			})
		);
	});

	it('fails closed when a route asks for a cost the policy cannot charge', async () => {
		const gate = createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'text', {
			guard: degradedGuard()
		});

		const decision = await gate(0);

		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.status).toBe(503);
			expect(decision.body.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
		}
	});

	it('never returns a raw address or an identity secret', async () => {
		const seam = seamReturning({
			ok: true,
			value: { allowed: true, limit: 20, used: 1, remaining: 19, resetAtMs: 60_000 }
		});
		const guard = createRateLimitGuard({
			loadConfig: () => CONFIG,
			createSeam: () => seam,
			now: () => 0
		});
		const allowed = await createQuotaGate(
			fakeEvent(() => CLIENT_ADDRESS),
			'text',
			{ guard }
		)(1);
		const denied = await createQuotaGate(fakeEvent(() => CLIENT_ADDRESS), 'text', {
			guard: degradedGuard()
		})(0);

		const serialized = JSON.stringify({
			allowed,
			denied,
			consumed: vi.mocked(seam.consume).mock.calls
		});
		expect(serialized).not.toMatch(/203\.0\.113\.7/);
		expect(serialized).not.toMatch(/fixture-identity-secret|fixture-store-token/);
	});
});
