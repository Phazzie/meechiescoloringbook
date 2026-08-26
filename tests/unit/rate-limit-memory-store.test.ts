// Purpose: Unit tests for the degraded in-process fixed-window rate-limit store.
// Why: Degraded mode must still meter every call, evict its own keys, and stay fail-closed and pseudonymous.
// Info flow: deterministic clock + consume inputs -> memory seam -> validated quota decisions and key-count assertions.
import { describe, expect, it, vi } from 'vitest';
import type { RateLimitConsumeInput } from '../../src/lib/seams/rate-limit-seam/contract';
import { validateRateLimitDecision } from '../../src/lib/seams/rate-limit-seam/validators';
import {
	MEMORY_RATE_LIMIT_MAX_TRACKED_KEYS,
	createMemoryRateLimitSeam,
	getMemoryRateLimitSeam,
	memoryRateLimitIdentitySecret
} from '../../src/lib/server/rate-limit-memory-store';

const identityKey = (index: number): string =>
	`rl:client:${index.toString(16).padStart(64, '0')}`;

const textInput = (index = 0): RateLimitConsumeInput => ({
	identityKey: identityKey(index),
	bucket: 'text',
	limit: 20,
	windowMs: 60_000,
	cost: 1
});

describe('memory rate-limit store enforcement', () => {
	it('allows exactly the configured budget and denies the next call', async () => {
		const seam = createMemoryRateLimitSeam({ now: () => 0 });
		const results = [];
		for (let call = 0; call < 21; call += 1) {
			results.push(await seam.consume(textInput()));
		}

		const allowed = results.filter((result) => result.ok && result.value.allowed);
		const denied = results.filter((result) => result.ok && !result.value.allowed);
		expect(allowed).toHaveLength(20);
		expect(denied).toHaveLength(1);
		const twentieth = results[19];
		expect(twentieth?.ok === true && twentieth.value).toEqual({
			allowed: true,
			limit: 20,
			used: 20,
			remaining: 0,
			resetAtMs: 60_000
		});
		const twentyFirst = results[20];
		expect(twentyFirst?.ok === true && twentyFirst.value).toEqual({
			allowed: false,
			limit: 20,
			used: 21,
			remaining: 0,
			resetAtMs: 60_000
		});
	});

	it('returns decisions that satisfy the seam decision schema', async () => {
		const seam = createMemoryRateLimitSeam({ now: () => 0 });
		const result = await seam.consume(textInput());

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(validateRateLimitDecision(result.value)).toEqual(result.value);
		}
	});

	it('keeps identities and buckets in separate windows', async () => {
		const seam = createMemoryRateLimitSeam({ now: () => 0 });
		await seam.consume(textInput(1));
		await seam.consume(textInput(1));
		const otherIdentity = await seam.consume(textInput(2));
		const otherBucket = await seam.consume({
			...textInput(1),
			bucket: 'image',
			limit: 8
		});

		expect(otherIdentity.ok === true && otherIdentity.value.used).toBe(1);
		expect(otherBucket.ok === true && otherBucket.value.used).toBe(1);
		expect(otherBucket.ok === true && otherBucket.value.limit).toBe(8);
		expect(seam.trackedKeyCount()).toBe(3);
	});

	it('charges weighted costs inside one window', async () => {
		const seam = createMemoryRateLimitSeam({ now: () => 0 });
		const image = { ...textInput(3), bucket: 'image' as const, limit: 8 };
		const first = await seam.consume({ ...image, cost: 3 });
		const second = await seam.consume({ ...image, cost: 4 });
		const denied = await seam.consume({ ...image, cost: 2 });

		expect(first.ok === true && first.value).toMatchObject({ used: 3, remaining: 5 });
		expect(second.ok === true && second.value).toMatchObject({ used: 7, remaining: 1 });
		expect(denied.ok === true && denied.value).toMatchObject({
			allowed: false,
			used: 9,
			remaining: 0
		});
	});

	it('starts a clean budget at the next fixed-window reset', async () => {
		let nowMs = 59_999;
		const seam = createMemoryRateLimitSeam({ now: () => nowMs });
		const before = await seam.consume(textInput(4));
		nowMs = 60_000;
		const after = await seam.consume(textInput(4));

		expect(before.ok === true && before.value).toMatchObject({
			used: 1,
			resetAtMs: 60_000
		});
		expect(after.ok === true && after.value).toMatchObject({
			used: 1,
			resetAtMs: 120_000
		});
	});
});

describe('memory rate-limit store eviction', () => {
	it('actively removes expired keys instead of only expiring them logically', async () => {
		let nowMs = 0;
		const seam = createMemoryRateLimitSeam({ now: () => nowMs });
		for (let index = 0; index < 25; index += 1) {
			await seam.consume(textInput(index));
		}
		expect(seam.trackedKeyCount()).toBe(25);

		nowMs = 60_000;
		await seam.consume(textInput(0));

		expect(seam.trackedKeyCount()).toBe(1);
	});

	it('does not grow without bound across many windows', async () => {
		let nowMs = 0;
		const seam = createMemoryRateLimitSeam({ now: () => nowMs });
		for (let window = 0; window < 40; window += 1) {
			nowMs = window * 60_000;
			for (let index = 0; index < 10; index += 1) {
				await seam.consume(textInput(window * 100 + index));
			}
		}

		expect(seam.trackedKeyCount()).toBe(10);
	});

	it('fails closed on new keys at the tracked-key ceiling while existing keys keep metering', async () => {
		let nowMs = 0;
		const seam = createMemoryRateLimitSeam({ now: () => nowMs, maxTrackedKeys: 3 });
		for (let index = 0; index < 3; index += 1) {
			expect((await seam.consume(textInput(index))).ok).toBe(true);
		}

		const overflow = await seam.consume(textInput(99));
		expect(overflow).toEqual({
			ok: false,
			error: {
				code: 'RATE_LIMIT_STORE_ERROR',
				message: 'Rate limit storage is unavailable.'
			}
		});

		const existing = await seam.consume(textInput(0));
		expect(existing.ok === true && existing.value.used).toBe(2);

		nowMs = 60_000;
		const afterReset = await seam.consume(textInput(99));
		expect(afterReset.ok).toBe(true);
	});

	it('defaults to a bounded tracked-key ceiling', () => {
		expect(MEMORY_RATE_LIMIT_MAX_TRACKED_KEYS).toBe(10_000);
	});
});

describe('memory rate-limit store failure handling', () => {
	it('rejects invalid consume input instead of allowing the call', async () => {
		const seam = createMemoryRateLimitSeam({ now: () => 0 });

		const zeroCost = await seam.consume({ ...textInput(), cost: 0 });
		const rawAddressKey = await seam.consume({
			...textInput(),
			identityKey: '203.0.113.7'
		});

		expect(zeroCost).toEqual({
			ok: false,
			error: {
				code: 'RATE_LIMIT_VALIDATION_ERROR',
				message: 'Rate limit operation failed validation.'
			}
		});
		expect(rawAddressKey.ok).toBe(false);
		expect(JSON.stringify(rawAddressKey)).not.toMatch(/203\.0\.113\.7/);
		expect(seam.trackedKeyCount()).toBe(0);
	});
});

describe('memory rate-limit identity secret', () => {
	it('is a per-process random secret, stable within the process', () => {
		const secret = memoryRateLimitIdentitySecret();

		expect(secret).toMatch(/^[a-f0-9]{64}$/);
		expect(memoryRateLimitIdentitySecret()).toBe(secret);
	});

	it('is generated at module load, never a hardcoded fallback', async () => {
		const secret = memoryRateLimitIdentitySecret();
		vi.resetModules();
		const reloaded = await import('../../src/lib/server/rate-limit-memory-store');

		expect(reloaded.memoryRateLimitIdentitySecret()).not.toBe(secret);
		expect(reloaded.memoryRateLimitIdentitySecret()).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe('memory rate-limit shared seam', () => {
	it('reuses one process-wide seam so counters survive between requests', async () => {
		expect(getMemoryRateLimitSeam()).toBe(getMemoryRateLimitSeam());

		const before = getMemoryRateLimitSeam().trackedKeyCount();
		await getMemoryRateLimitSeam().consume(textInput(4242));

		expect(getMemoryRateLimitSeam().trackedKeyCount()).toBe(before + 1);
	});
});
