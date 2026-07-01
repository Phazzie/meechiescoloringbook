// Purpose: Unit tests for http-resilience fetch utilities.
// Why: Timeout and retry logic must be verified deterministically with fake timers;
//      real network calls would make these tests slow and flaky.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchWithTimeout,
	fetchWithRetry,
	isAbortError,
	isCircuitOpenError,
	createCircuitBreaker
} from '../../src/lib/core/http-resilience';

// ---------------------------------------------------------------------------
// isAbortError
// ---------------------------------------------------------------------------

describe('isAbortError', () => {
	it('returns true for an Error with name AbortError', () => {
		const error = Object.assign(new Error('aborted'), { name: 'AbortError' });
		expect(isAbortError(error)).toBe(true);
	});

	it('returns true for a structural DOMException-like AbortError', () => {
		expect(isAbortError({ name: 'AbortError', message: 'aborted' })).toBe(true);
	});

	it('returns false for a plain Error', () => {
		expect(isAbortError(new Error('network failure'))).toBe(false);
	});

	it('returns false for a non-Error value', () => {
		expect(isAbortError('AbortError')).toBe(false);
		expect(isAbortError(null)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isCircuitOpenError
// ---------------------------------------------------------------------------

describe('isCircuitOpenError', () => {
	it('returns true for an Error with name CircuitOpenError', () => {
		const error = Object.assign(new Error('open'), { name: 'CircuitOpenError' });
		expect(isCircuitOpenError(error)).toBe(true);
	});

	it('returns false for an AbortError', () => {
		const error = Object.assign(new Error('aborted'), { name: 'AbortError' });
		expect(isCircuitOpenError(error)).toBe(false);
	});

	it('returns false for a non-Error value', () => {
		expect(isCircuitOpenError(null)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// fetchWithTimeout
// ---------------------------------------------------------------------------

describe('fetchWithTimeout', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('resolves with the response when the request completes before the timeout', async () => {
		const mockResponse = new Response('ok', { status: 200 });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

		const result = await fetchWithTimeout('https://example.com', {}, 5_000);
		expect(result.status).toBe(200);
	});

	it('aborts and rejects with a TimeoutError when timeout fires', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url: string, init: RequestInit) => {
				return new Promise<Response>((_, reject) => {
					init.signal!.addEventListener('abort', () => {
						reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
					});
				});
			})
		);

		const rejection = fetchWithTimeout('https://example.com', {}, 1_000).catch((error) => error);
		await vi.runAllTimersAsync();
		await expect(rejection).resolves.toMatchObject({ name: 'TimeoutError' });
	});

	it('clears the timer so it does not fire after a fast response', async () => {
		const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));

		await fetchWithTimeout('https://example.com', {}, 5_000);

		expect(clearSpy).toHaveBeenCalled();
	});

	it('forwards upstream abort to the internal controller', async () => {
		const upstream = new AbortController();
		let signalUsed: AbortSignal | null = null;

		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url: string, init: RequestInit) => {
				signalUsed = init.signal!;
				return new Promise<Response>((_, reject) => {
					init.signal!.addEventListener('abort', () => {
						reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
					});
				});
			})
		);

		const promise = fetchWithTimeout('https://example.com', { signal: upstream.signal }, 5_000);
		const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
		upstream.abort();
		await assertion;
		expect((signalUsed as AbortSignal | null)?.aborted).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// fetchWithRetry
// ---------------------------------------------------------------------------

describe('fetchWithRetry', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('rejects when maxAttempts is less than 1', async () => {
		await expect(fetchWithRetry(vi.fn(), { maxAttempts: 0, baseDelayMs: 100 }))
			.rejects.toThrow('maxAttempts must be a finite integer >= 1');
	});

	it.each([
		['NaN', NaN],
		['Infinity', Infinity],
		['non-integer', 1.5]
	])('rejects when maxAttempts is %s', async (_label, maxAttempts) => {
		await expect(fetchWithRetry(vi.fn(), { maxAttempts, baseDelayMs: 100 }))
			.rejects.toThrow('maxAttempts must be a finite integer >= 1');
	});

	it('rejects when baseDelayMs is negative', async () => {
		await expect(fetchWithRetry(vi.fn(), { maxAttempts: 3, baseDelayMs: -1 }))
			.rejects.toThrow('baseDelayMs must be finite and >= 0');
	});

	it.each([
		['NaN', NaN],
		['Infinity', Infinity]
	])('rejects when baseDelayMs is %s', async (_label, baseDelayMs) => {
		await expect(fetchWithRetry(vi.fn(), { maxAttempts: 3, baseDelayMs }))
			.rejects.toThrow('baseDelayMs must be finite and >= 0');
	});

	it('returns immediately on a 200 response without retrying', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		const result = await fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('retries on 429 and returns the successful second response', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('retries on 503 and exhausts all attempts, returning the last response', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.status).toBe(503);
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('does not retry on 400 Bad Request', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));

		const result = await fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });

		expect(result.status).toBe(400);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('does not retry on 401 Unauthorized', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));

		const result = await fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });

		expect(result.status).toBe(401);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('retries on AbortError (timeout) and returns success on the next attempt', async () => {
		const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(abortError)
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('fails fast on an already-aborted signal without calling the fetcher', async () => {
		const caller = new AbortController();
		caller.abort();
		const fetcher = vi.fn();
		const options = {
			maxAttempts: 3,
			baseDelayMs: 100,
			signal: caller.signal
		} as Parameters<typeof fetchWithRetry>[1];

		const rejection = fetchWithRetry(fetcher, options).catch((error) => error);
		await vi.runAllTimersAsync();

		await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('throws after exhausting retries on repeated AbortErrors', async () => {
		const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
		const fetcher = vi.fn().mockRejectedValue(abortError);

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });
		const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
		await vi.runAllTimersAsync();
		await assertion;

		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('does not retry on non-abort thrown errors', async () => {
		const networkError = new Error('ECONNREFUSED');
		const fetcher = vi.fn().mockRejectedValue(networkError);

		await expect(
			fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 })
		).rejects.toThrow('ECONNREFUSED');
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('respects the Retry-After header (delta-seconds) on 429', async () => {
		const rateLimitedHeaders = new Headers({ 'Retry-After': '2' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: rateLimitedHeaders }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 50 });
		await vi.advanceTimersByTimeAsync(2_001);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('respects the Retry-After header (HTTP-date) on 429', async () => {
		const retryAt = new Date(Date.now() + 2_000).toUTCString();
		const headers = new Headers({ 'Retry-After': retryAt });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 50 });
		await vi.advanceTimersByTimeAsync(2_100);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('caps jittered exponential backoff at 30 seconds when Retry-After is absent', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		let settled = false;

		const promise = fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 1_000_000 });
		promise.then(() => {
			settled = true;
		});
		await vi.advanceTimersByTimeAsync(30_001);

		expect(settled).toBe(true);
		const result = await promise;
		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('honors a Retry-After within the give-up threshold instead of clamping it to the self-backoff cap', async () => {
		const retryHeaders = new Headers({ 'Retry-After': '20' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: retryHeaders }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		let settled = false;

		const promise = fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 50 });
		promise.then(() => {
			settled = true;
		});

		await vi.advanceTimersByTimeAsync(19_999);
		expect(settled).toBe(false);
		expect(fetcher).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1);
		expect(settled).toBe(true);
		const result = await promise;
		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('gives up instead of sleeping when Retry-After exceeds the give-up threshold', async () => {
		const longRetryHeaders = new Headers({ 'Retry-After': '3600' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: longRetryHeaders }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const result = await fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 50 });

		// A Retry-After this long would tie up the caller for an hour; fetchWithRetry must
		// return the retryable response immediately rather than sleeping for it.
		expect(result.status).toBe(429);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('fails fast with a CircuitOpenError without calling the fetcher when the breaker is open', async () => {
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 30_000, now: () => 0 });
		breaker.recordFailure();
		const fetcher = vi.fn();

		await expect(
			fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100, breaker })
		).rejects.toMatchObject({ name: 'CircuitOpenError' });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('surfaces AbortError, not CircuitOpenError, when the caller is already aborted and the breaker is open', async () => {
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 30_000, now: () => 0 });
		breaker.recordFailure();
		const caller = new AbortController();
		caller.abort();
		const fetcher = vi.fn();

		await expect(
			fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100, breaker, signal: caller.signal })
		).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('records a breaker failure on a retryable response; a 2xx response defers success to the caller', async () => {
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 30_000, now: () => 0 });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 50, breaker });
		await vi.runAllTimersAsync();
		const result = await promise;

		// The first attempt's failure opened the breaker mid-call, but the in-flight retry was
		// not aborted (the breaker only gates new calls). A 2xx response's body hasn't been
		// read yet, so fetchWithRetry itself leaves the breaker open — recordSuccess() is the
		// caller's job, once it has actually read the body (see provider-adapter.adapter.ts).
		expect(result.status).toBe(200);
		expect(breaker.isOpen()).toBe(true);

		breaker.recordSuccess();
		expect(breaker.isOpen()).toBe(false);
	});

	it('records success immediately for a non-retryable non-2xx response (no body dependency)', async () => {
		let now = 0;
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 30_000, now: () => now });
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(true);

		// Cooldown elapses so the next call is a trial request the breaker will let through.
		now = 30_000;
		const fetcher = vi.fn().mockResolvedValueOnce(new Response('bad request', { status: 400 }));

		const result = await fetchWithRetry(fetcher, { maxAttempts: 1, baseDelayMs: 50, breaker });

		// A non-retryable, non-2xx status proves the upstream is reachable regardless of the
		// (unread) body, so the breaker closes immediately rather than waiting on a body read.
		expect(result.status).toBe(400);
		expect(breaker.isOpen()).toBe(false);
	});

	it('records a breaker failure on a thrown network error', async () => {
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 30_000, now: () => 0 });
		const fetcher = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

		await expect(
			fetchWithRetry(fetcher, { maxAttempts: 1, baseDelayMs: 50, breaker })
		).rejects.toThrow('ECONNREFUSED');
		expect(breaker.isOpen()).toBe(true);
	});

	it('does not record a breaker failure on an AbortError', async () => {
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 30_000, now: () => 0 });
		const fetcher = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

		await expect(
			fetchWithRetry(fetcher, { maxAttempts: 1, baseDelayMs: 50, breaker })
		).rejects.toMatchObject({ name: 'AbortError' });
		expect(breaker.isOpen()).toBe(false);
	});
});

describe('createCircuitBreaker', () => {
	it('starts closed', () => {
		const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000 });
		expect(breaker.isOpen()).toBe(false);
	});

	it('stays closed until consecutive failures reach the threshold', () => {
		let now = 0;
		const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 1_000, now: () => now });

		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(false);
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(false);
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(true);
	});

	it('closes again once the cooldown elapses', () => {
		let now = 0;
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000, now: () => now });

		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(true);

		now = 999;
		expect(breaker.isOpen()).toBe(true);

		now = 1_000;
		expect(breaker.isOpen()).toBe(false);
	});

	it('resets consecutive-failure count after cooldown so one fresh failure does not reopen with threshold > 1', () => {
		let now = 0;
		const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000, now: () => now });

		// First failure before cooldown — breaker stays closed.
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(false);

		// Force open by recording a second failure.
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(true);

		// Cooldown elapses — stale failure count should reset.
		now = 1_000;
		expect(breaker.isOpen()).toBe(false);

		// One fresh failure after cooldown should NOT reopen the breaker (threshold is 2).
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(false);

		// Second fresh failure now trips the threshold again.
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(true);
	});

	it('resets the consecutive-failure count on success', () => {
		let now = 0;
		const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000, now: () => now });

		breaker.recordFailure();
		breaker.recordSuccess();
		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(false);
	});

	it('closes immediately on success even while open', () => {
		let now = 0;
		const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000, now: () => now });

		breaker.recordFailure();
		expect(breaker.isOpen()).toBe(true);

		breaker.recordSuccess();
		expect(breaker.isOpen()).toBe(false);
	});

	it('rejects a non-positive-integer failureThreshold', () => {
		expect(() => createCircuitBreaker({ failureThreshold: 0, cooldownMs: 1_000 })).toThrow(
			'failureThreshold must be a finite integer >= 1'
		);
	});

	it('rejects a negative cooldownMs', () => {
		expect(() => createCircuitBreaker({ failureThreshold: 1, cooldownMs: -1 })).toThrow(
			'cooldownMs must be finite and >= 0'
		);
	});
});
