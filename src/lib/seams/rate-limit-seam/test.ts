// Purpose: Contract and adapter tests for atomic durable RateLimitSeam behavior.
// Why: Prove fixture validation, exact quota boundaries, concurrency, reset, and weighted costs.
// Info flow: fixtures/fake Upstash transport -> seam -> validated quota decisions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimitSeam } from '../../adapters/rate-limit-seam';
import {
	rateLimitConsumeFixture,
	rateLimitDecisionFaultFixture,
	rateLimitDecisionFixture,
	rateLimitStoreErrorFixture
} from './fixtures';
import { createMockRateLimitSeam } from './mock';
import {
	validateRateLimitConsumeInput,
	validateRateLimitDecision
} from './validators';

type FakeAtomicStore = {
	fetchImpl: typeof fetch;
	counts: Map<string, number>;
	expiresAtMs: Map<string, number>;
	requests: Array<{ url: string; init: RequestInit; command: unknown[] }>;
};

const createFakeAtomicStore = (now: () => number): FakeAtomicStore => {
	const counts = new Map<string, number>();
	const expiresAtMs = new Map<string, number>();
	const requests: FakeAtomicStore['requests'] = [];
	const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const command = JSON.parse(String(init?.body)) as unknown[];
		requests.push({ url: String(input), init: init ?? {}, command });
		for (const [storedKey, resetAtMs] of expiresAtMs) {
			if (resetAtMs <= now()) {
				counts.delete(storedKey);
				expiresAtMs.delete(storedKey);
			}
		}
		const script = String(command[1]);
		const key = String(command[3]);
		const cost = Number(command[4]);
		const resetAtMs = Number(command[5]);
		const isNewKey = !counts.has(key);
		const used = (counts.get(key) ?? 0) + cost;
		counts.set(key, used);
		if (isNewKey && /redis\.call\(\s*['"]PEXPIREAT['"]/.test(script)) {
			expiresAtMs.set(key, resetAtMs);
		}
		return new Response(JSON.stringify({ result: [used, resetAtMs] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}) as typeof fetch;
	return { fetchImpl, counts, expiresAtMs, requests };
};

const createAdapterHarness = (nowRef = { value: 0 }) => {
	const store = createFakeAtomicStore(() => nowRef.value);
	const seam = createRateLimitSeam(
		{
			restUrl: 'https://fixture-upstash.example',
			restToken: 'fixture-store-token',
			timeoutMs: 1_000
		},
		{ fetchImpl: store.fetchImpl, now: () => nowRef.value }
	);
	return { seam, store, nowRef };
};

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('RateLimitSeam contract', () => {
	it('validates the fixture-backed sample mock result', async () => {
		const input = validateRateLimitConsumeInput(rateLimitConsumeFixture);
		const result = await createMockRateLimitSeam('sample').consume(input);

		expect(result).toEqual({ ok: true, value: rateLimitDecisionFixture });
		if (result.ok) {
			expect(validateRateLimitDecision(result.value)).toEqual(rateLimitDecisionFixture);
		}
	});

	it('rejects the fault fixture before adapter implementation (red proof)', () => {
		expect(() => validateRateLimitDecision(rateLimitDecisionFaultFixture)).toThrow();
	});

	it('returns the fixture-backed store failure from the mock', async () => {
		const result = await createMockRateLimitSeam('store_error').consume(
			rateLimitConsumeFixture
		);
		expect(result).toEqual({ ok: false, error: rateLimitStoreErrorFixture });
	});
});

describe('RateLimitSeam Upstash adapter', () => {
	it('uses one bearer-authenticated atomic EVAL request without exposing the store token in URL/body', async () => {
		const { seam, store } = createAdapterHarness();
		const result = await seam.consume(rateLimitConsumeFixture);

		expect(result.ok).toBe(true);
		expect(store.requests).toHaveLength(1);
		const request = store.requests[0];
		expect(request.url).toBe('https://fixture-upstash.example');
		expect(new Headers(request.init.headers).get('Authorization')).toBe(
			'Bearer fixture-store-token'
		);
		expect(request.command.slice(0, 3)).toEqual(['EVAL', expect.any(String), '1']);
		expect(`${request.url}${String(request.init.body)}`).not.toContain(
			'fixture-store-token'
		);
	});

	it('allows exactly the configured boundary and rejects the next concurrent cost', async () => {
		const { seam } = createAdapterHarness();
		const decisions = await Promise.all(
			Array.from({ length: 21 }, () => seam.consume(rateLimitConsumeFixture))
		);
		const successful = decisions.filter((result) => result.ok && result.value.allowed);
		const denied = decisions.filter((result) => result.ok && !result.value.allowed);

		expect(successful).toHaveLength(20);
		expect(denied).toHaveLength(1);
		if (denied[0]?.ok) {
			expect(denied[0].value).toMatchObject({ used: 21, remaining: 0 });
		}
	});

	it('starts a clean bucket at the next fixed-window reset', async () => {
		const nowRef = { value: 59_999 };
		const { seam, store } = createAdapterHarness(nowRef);
		const beforeReset = await seam.consume(rateLimitConsumeFixture);
		const oldKey = String(store.requests[0]?.command[3]);
		nowRef.value = 60_000;
		const afterReset = await seam.consume(rateLimitConsumeFixture);
		const newKey = String(store.requests[1]?.command[3]);

		expect(beforeReset).toMatchObject({
			ok: true,
			value: { used: 1, remaining: 19, resetAtMs: 60_000 }
		});
		expect(afterReset).toMatchObject({
			ok: true,
			value: { used: 1, remaining: 19, resetAtMs: 120_000 }
		});
		expect(newKey).not.toBe(oldKey);
		expect(store.counts.has(oldKey)).toBe(false);
		expect(store.counts.get(newKey)).toBe(1);
		expect(store.counts).toHaveLength(1);
		expect(store.expiresAtMs.has(oldKey)).toBe(false);
		expect(store.expiresAtMs.get(newKey)).toBe(120_000);
	});

	it('charges weighted costs atomically', async () => {
		const { seam } = createAdapterHarness();
		const input = { ...rateLimitConsumeFixture, bucket: 'image' as const, limit: 8 };
		const first = await seam.consume({ ...input, cost: 3 });
		const second = await seam.consume({ ...input, cost: 4 });
		const denied = await seam.consume({ ...input, cost: 2 });

		expect(first).toMatchObject({ ok: true, value: { used: 3, remaining: 5 } });
		expect(second).toMatchObject({ ok: true, value: { used: 7, remaining: 1 } });
		expect(denied).toMatchObject({
			ok: true,
			value: { allowed: false, used: 9, remaining: 0 }
		});
	});

	it('returns a stable timeout failure when the store does not settle', async () => {
		vi.useFakeTimers();
		const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					reject(Object.assign(new Error('secret timeout body'), { name: 'AbortError' }));
				});
			})
		) as typeof fetch;
		const seam = createRateLimitSeam(
			{
				restUrl: 'https://fixture-upstash.example',
				restToken: 'fixture-store-token',
				timeoutMs: 50
			},
			{ fetchImpl, now: () => 0 }
		);
		const pending = seam.consume(rateLimitConsumeFixture);

		await vi.advanceTimersByTimeAsync(50);
		await expect(pending).resolves.toEqual({
			ok: false,
			error: {
				code: 'RATE_LIMIT_TIMEOUT',
				message: 'Rate limit storage timed out.'
			}
		});
	});

	it('returns a stable store failure without upstream exception text', async () => {
		const seam = createRateLimitSeam(
			{
				restUrl: 'https://fixture-upstash.example',
				restToken: 'fixture-store-token',
				timeoutMs: 1_000
			},
			{
				fetchImpl: vi.fn().mockRejectedValue(
					new Error('raw-address=192.0.2.44 identity-secret=do-not-leak')
				),
				now: () => 0
			}
		);

		const result = await seam.consume(rateLimitConsumeFixture);
		expect(result).toEqual({
			ok: false,
			error: {
				code: 'RATE_LIMIT_STORE_ERROR',
				message: 'Rate limit storage is unavailable.'
			}
		});
		expect(JSON.stringify(result)).not.toMatch(/192\.0\.2\.44|do-not-leak/);
	});
});
