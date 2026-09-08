// Purpose: Unit tests for rate-limit configuration, shared policy, and fail-closed guard behavior.
// Why: Missing identity differs from store/config failure, and no secret-bearing failure may escape.
// Info flow: config/address/fake seam -> guard -> status and reset-derived headers.
import { describe, expect, it, vi } from 'vitest';
import type { RateLimitSeam } from '../../src/lib/seams/rate-limit-seam/contract';
import {
	RATE_LIMIT_POLICIES,
	createRateLimitGuard,
	isDurableRateLimitConfigAbsent
} from '../../src/lib/server/rate-limit-guard';
import {
	loadRateLimitConfig,
	type RateLimitConfig
} from '../../src/lib/server/rate-limit-config';
import {
	createMemoryRateLimitSeam,
	memoryRateLimitIdentitySecret
} from '../../src/lib/server/rate-limit-memory-store';
import { resolveRateLimitIdentity } from '../../src/lib/server/rate-limit-identity';

const CONFIG: RateLimitConfig = {
	upstashRestUrl: 'https://fixture-upstash.example',
	upstashRestToken: 'fixture-store-token',
	identitySecret: 'fixture-identity-secret',
	operationTimeoutMs: 1_500
};

const FULL_ENVIRONMENT = {
	UPSTASH_REDIS_REST_URL: 'https://fixture-upstash.example',
	UPSTASH_REDIS_REST_TOKEN: 'fixture-store-token',
	RATE_LIMIT_IDENTITY_SECRET: 'fixture-identity-secret'
};

// Somebody started configuring durable limiting and stopped halfway.
const PARTIAL_ENVIRONMENT = {
	UPSTASH_REDIS_REST_URL: 'https://fixture-upstash.example'
};

const createSeam = (
	result: Awaited<ReturnType<RateLimitSeam['consume']>>
): RateLimitSeam => ({
	consume: vi.fn().mockResolvedValue(result)
});

const allowedResult = {
	ok: true as const,
	value: { allowed: true, limit: 20, used: 1, remaining: 19, resetAtMs: 60_000 }
};

describe('rate-limit configuration and policies', () => {
	it('defines the shared one-minute text and image budgets', () => {
		expect(RATE_LIMIT_POLICIES).toEqual({
			text: { limit: 20, windowMs: 60_000 },
			image: { limit: 8, windowMs: 60_000 }
		});
	});

	it('loads required private settings with the default operation timeout', () => {
		expect(
			loadRateLimitConfig({
				UPSTASH_REDIS_REST_URL: 'https://fixture-upstash.example/',
				UPSTASH_REDIS_REST_TOKEN: 'store-token',
				RATE_LIMIT_IDENTITY_SECRET: 'identity-secret'
			})
		).toEqual({
			upstashRestUrl: 'https://fixture-upstash.example',
			upstashRestToken: 'store-token',
			identitySecret: 'identity-secret',
			operationTimeoutMs: 1_500
		});
	});

	it('rejects missing secrets, missing store settings, insecure URLs, and invalid timeouts', () => {
		const validEnvironment = {
			UPSTASH_REDIS_REST_URL: 'https://fixture-upstash.example',
			UPSTASH_REDIS_REST_TOKEN: 'store-token',
			RATE_LIMIT_IDENTITY_SECRET: 'identity-secret'
		};
		expect(() =>
			loadRateLimitConfig({ ...validEnvironment, RATE_LIMIT_IDENTITY_SECRET: '' })
		).toThrow('Rate limit configuration is invalid.');
		expect(() =>
			loadRateLimitConfig({ ...validEnvironment, UPSTASH_REDIS_REST_TOKEN: '' })
		).toThrow('Rate limit configuration is invalid.');
		expect(() =>
			loadRateLimitConfig({
				...validEnvironment,
				UPSTASH_REDIS_REST_URL: 'http://fixture-upstash.example'
			})
		).toThrow('Rate limit configuration is invalid.');
		expect(() =>
			loadRateLimitConfig({ ...validEnvironment, RATE_LIMIT_OPERATION_TIMEOUT_MS: '0' })
		).toThrow('Rate limit configuration is invalid.');
	});
});

describe('rate-limit guard', () => {
	it('forwards weighted text cost with a pseudonymous identity and reset-derived headers', async () => {
		const seam = createSeam({
			ok: true,
			value: { allowed: true, limit: 20, used: 3, remaining: 17, resetAtMs: 60_000 }
		});
		const guard = createRateLimitGuard({
			loadConfig: () => CONFIG,
			createSeam: () => seam,
			now: () => 1_000
		});

		const result = await guard({
			bucket: 'text',
			cost: 3,
			getClientAddress: () => '192.0.2.44'
		});

		expect(result).toEqual({
			ok: true,
			status: 200,
			headers: {
				'Cache-Control': 'no-store',
				'RateLimit-Limit': '20',
				'RateLimit-Remaining': '17',
				'RateLimit-Reset': '59'
			},
			identityKind: 'pseudonymous',
			store: 'durable',
			limit: 20,
			remaining: 17,
			resetAtMs: 60_000
		});
		expect(seam.consume).toHaveBeenCalledWith({
			identityKey: expect.stringMatching(/^rl:client:[a-f0-9]{64}$/),
			bucket: 'text',
			limit: 20,
			windowMs: 60_000,
			cost: 3
		});
		const serialized = JSON.stringify({ result, call: vi.mocked(seam.consume).mock.calls[0] });
		expect(serialized).not.toMatch(/192\.0\.2\.44|fixture-identity-secret|fixture-store-token/);
	});

	it('returns 429 with retry and limit headers derived from the reset', async () => {
		const seam = createSeam({
			ok: true,
			value: { allowed: false, limit: 8, used: 9, remaining: 0, resetAtMs: 61_000 }
		});
		const guard = createRateLimitGuard({
			loadConfig: () => CONFIG,
			createSeam: () => seam,
			now: () => 1_000
		});

		const result = await guard({ bucket: 'image', getClientAddress: () => '192.0.2.44' });

		expect(result).toEqual({
			ok: false,
			status: 429,
			headers: {
				'Cache-Control': 'no-store',
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '0',
				'RateLimit-Reset': '60',
				'Retry-After': '60'
			},
			error: {
				code: 'RATE_LIMITED',
				message: 'Too many requests. Try again after the current window resets.'
			}
		});
	});

	it('uses the shared fallback identity when client-address lookup throws', async () => {
		const seam = createSeam({
			ok: true,
			value: { allowed: true, limit: 20, used: 1, remaining: 19, resetAtMs: 60_000 }
		});
		const guard = createRateLimitGuard({
			loadConfig: () => CONFIG,
			createSeam: () => seam,
			now: () => 1_000
		});

		const result = await guard({
			bucket: 'text',
			getClientAddress: () => {
				throw new Error('lookup failed');
			}
		});

		expect(result).toMatchObject({ ok: true, identityKind: 'fallback' });
		expect(seam.consume).toHaveBeenCalledWith(
			expect.objectContaining({
				identityKey: expect.stringMatching(/^rl:fallback:[a-f0-9]{64}$/)
			})
		);
	});

	it.each([
		[
			'configuration failure',
			{
				readEnvironment: () => PARTIAL_ENVIRONMENT,
				loadConfig: () => {
					throw new Error('config-secret=do-not-leak');
				}
			}
		],
		[
			'store failure',
			{
				loadConfig: () => CONFIG,
				createSeam: () =>
					createSeam({
						ok: false,
						error: {
							code: 'RATE_LIMIT_STORE_ERROR',
							message: 'raw-address=192.0.2.44 secret=do-not-leak'
						}
					})
			}
		],
		[
			'timeout failure',
			{
				loadConfig: () => CONFIG,
				createSeam: () =>
					createSeam({
						ok: false,
						error: {
							code: 'RATE_LIMIT_TIMEOUT',
							message: 'timeout secret=do-not-leak'
						}
					})
			}
		],
		[
			'operation throw',
			{
				loadConfig: () => CONFIG,
				createSeam: () => ({
					consume: vi.fn().mockRejectedValue(
						new Error('raw-address=192.0.2.44 secret=do-not-leak')
					)
				})
			}
		]
	] as const)('fails closed with 503 on %s', async (_label, dependencies) => {
		const guard = createRateLimitGuard(dependencies);
		const result = await guard({
			bucket: 'text',
			getClientAddress: () => '192.0.2.44'
		});

		expect(result).toEqual({
			ok: false,
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
			error: {
				code: 'RATE_LIMIT_UNAVAILABLE',
				message: 'Rate limiting is temporarily unavailable.'
			}
		});
		expect(JSON.stringify(result)).not.toMatch(/192\.0\.2\.44|do-not-leak/);
	});
});

describe('rate-limit store selection', () => {
	const memorySeamFactory = () => {
		const seam = createMemoryRateLimitSeam({ now: () => 0 });
		const create = vi.fn(() => seam);
		return { seam, create };
	};

	it('uses the durable store when every durable setting is present and valid', async () => {
		const memory = memorySeamFactory();
		const durable = createSeam(allowedResult);
		const guard = createRateLimitGuard({
			readEnvironment: () => FULL_ENVIRONMENT,
			createSeam: () => durable,
			createMemorySeam: memory.create,
			now: () => 0
		});

		const result = await guard({ bucket: 'text', getClientAddress: () => '192.0.2.44' });

		expect(result).toMatchObject({ ok: true, store: 'durable' });
		expect(durable.consume).toHaveBeenCalledTimes(1);
		expect(memory.create).not.toHaveBeenCalled();
	});

	it('degrades to the in-process store when no durable setting is present', async () => {
		const memory = memorySeamFactory();
		const durable = createSeam(allowedResult);
		const guard = createRateLimitGuard({
			readEnvironment: () => ({}),
			createSeam: () => durable,
			createMemorySeam: memory.create,
			now: () => 0
		});

		const result = await guard({ bucket: 'text', getClientAddress: () => '192.0.2.44' });

		expect(result).toMatchObject({
			ok: true,
			store: 'memory',
			identityKind: 'pseudonymous',
			limit: 20,
			remaining: 19
		});
		expect(durable.consume).not.toHaveBeenCalled();
		expect(memory.seam.trackedKeyCount()).toBe(1);
	});

	it('treats blank durable settings as absent', async () => {
		const memory = memorySeamFactory();
		const guard = createRateLimitGuard({
			readEnvironment: () => ({
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: '   ',
				RATE_LIMIT_IDENTITY_SECRET: undefined
			}),
			createMemorySeam: memory.create,
			now: () => 0
		});

		const result = await guard({ bucket: 'text', getClientAddress: () => '192.0.2.44' });

		expect(result).toMatchObject({ ok: true, store: 'memory' });
	});

	it('still enforces the exact budget in degraded mode', async () => {
		const memory = memorySeamFactory();
		const guard = createRateLimitGuard({
			readEnvironment: () => ({}),
			createMemorySeam: memory.create,
			now: () => 0
		});
		const results = [];
		for (let call = 0; call < 21; call += 1) {
			results.push(await guard({ bucket: 'text', getClientAddress: () => '192.0.2.44' }));
		}

		expect(results.slice(0, 20).every((result) => result.ok)).toBe(true);
		expect(results[20]).toMatchObject({
			ok: false,
			status: 429,
			error: { code: 'RATE_LIMITED' }
		});
	});

	it('derives degraded identities from the per-process secret, not the durable one', async () => {
		const memory = memorySeamFactory();
		const guard = createRateLimitGuard({
			readEnvironment: () => ({}),
			createMemorySeam: memory.create,
			now: () => 0
		});

		const result = await guard({ bucket: 'text', getClientAddress: () => '192.0.2.44' });
		const durableKey = resolveRateLimitIdentity({
			identitySecret: CONFIG.identitySecret,
			getClientAddress: () => '192.0.2.44'
		}).key;
		const degradedKey = resolveRateLimitIdentity({
			identitySecret: memoryRateLimitIdentitySecret(),
			getClientAddress: () => '192.0.2.44'
		}).key;

		expect(result).toMatchObject({ ok: true, identityKind: 'pseudonymous' });
		expect(degradedKey).not.toBe(durableKey);
		expect(JSON.stringify(result)).not.toMatch(/192\.0\.2\.44|[a-f0-9]{64}/);
	});

	it.each([
		['store url only', { UPSTASH_REDIS_REST_URL: 'https://fixture-upstash.example' }],
		['identity secret only', { RATE_LIMIT_IDENTITY_SECRET: 'identity-secret' }],
		[
			'store settings without an identity secret',
			{
				UPSTASH_REDIS_REST_URL: 'https://fixture-upstash.example',
				UPSTASH_REDIS_REST_TOKEN: 'store-token'
			}
		],
		[
			'an insecure store url',
			{ ...FULL_ENVIRONMENT, UPSTASH_REDIS_REST_URL: 'http://fixture-upstash.example' }
		],
		[
			'an invalid operation timeout',
			{ ...FULL_ENVIRONMENT, RATE_LIMIT_OPERATION_TIMEOUT_MS: 'soon' }
		]
	])('fails closed with 503 on %s and never reaches the memory store', async (
		_label,
		environment
	) => {
		const memory = memorySeamFactory();
		const guard = createRateLimitGuard({
			readEnvironment: () => environment,
			createMemorySeam: memory.create,
			now: () => 0
		});

		const result = await guard({ bucket: 'text', getClientAddress: () => '192.0.2.44' });

		expect(result).toEqual({
			ok: false,
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
			error: {
				code: 'RATE_LIMIT_UNAVAILABLE',
				message: 'Rate limiting is temporarily unavailable.'
			}
		});
		expect(memory.create).not.toHaveBeenCalled();
	});

	it('classifies durable configuration presence without reading the timeout override', () => {
		expect(isDurableRateLimitConfigAbsent({})).toBe(true);
		expect(
			isDurableRateLimitConfigAbsent({ RATE_LIMIT_OPERATION_TIMEOUT_MS: '1500' })
		).toBe(true);
		expect(isDurableRateLimitConfigAbsent(FULL_ENVIRONMENT)).toBe(false);
		expect(isDurableRateLimitConfigAbsent(PARTIAL_ENVIRONMENT)).toBe(false);
		expect(
			isDurableRateLimitConfigAbsent({ UPSTASH_REDIS_REST_TOKEN: 'store-token' })
		).toBe(false);
		expect(
			isDurableRateLimitConfigAbsent({ RATE_LIMIT_IDENTITY_SECRET: ' ' })
		).toBe(true);
	});
});
