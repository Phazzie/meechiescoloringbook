// Purpose: Unit tests for http-resilience fetch utilities.
// Why: Timeout and retry logic must be verified deterministically with fake timers;
//      real network calls would make these tests slow and flaky.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, fetchWithRetry, isAbortError } from '../../src/lib/core/http-resilience';

// ---------------------------------------------------------------------------
// isAbortError
// ---------------------------------------------------------------------------

describe('isAbortError', () => {
	it('returns true for an Error with name AbortError', () => {
		const error = Object.assign(new Error('aborted'), { name: 'AbortError' });
		expect(isAbortError(error)).toBe(true);
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

	it('aborts and rejects with an AbortError when timeout fires', async () => {
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

		const promise = fetchWithTimeout('https://example.com', {}, 1_000);
		// Attach rejection handler before advancing timers to prevent unhandled rejection warning.
		const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
		await vi.runAllTimersAsync();
		await assertion;
	});

	it('clears the timer so it does not fire after a fast response', async () => {
		const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));

		await fetchWithTimeout('https://example.com', {}, 5_000);

		expect(clearSpy).toHaveBeenCalled();
	});

	it('propagates caller abort signal before timeout fires', async () => {
		const callerController = new AbortController();
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

		const promise = fetchWithTimeout('https://example.com', { signal: callerController.signal }, 60_000);
		const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
		callerController.abort();
		await assertion;
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

	it('throws when maxAttempts is less than 1', async () => {
		const fetcher = vi.fn();
		await expect(fetchWithRetry(fetcher, { maxAttempts: 0, baseDelayMs: 100 })).rejects.toThrow(
			'maxAttempts must be >= 1'
		);
	});

	it('throws when baseDelayMs is negative', async () => {
		const fetcher = vi.fn();
		await expect(fetchWithRetry(fetcher, { maxAttempts: 1, baseDelayMs: -1 })).rejects.toThrow(
			'baseDelayMs must be >= 0'
		);
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

	it('throws after exhausting retries on repeated AbortErrors', async () => {
		const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
		const fetcher = vi.fn().mockRejectedValue(abortError);

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 100 });
		// Attach rejection handler BEFORE advancing timers to prevent unhandled rejection.
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

	it('respects the Retry-After header on 429 (delta-seconds)', async () => {
		const rateLimitedHeaders = new Headers({ 'Retry-After': '2' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: rateLimitedHeaders }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 3, baseDelayMs: 50 });
		// Advance 2 seconds (Retry-After value) to unblock the sleep.
		await vi.advanceTimersByTimeAsync(2_001);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('respects the Retry-After header on 429 (HTTP-date format)', async () => {
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

	it('caps Retry-After at 30 seconds', async () => {
		const longRetryHeaders = new Headers({ 'Retry-After': '3600' }); // 1 hour
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: longRetryHeaders }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 50 });
		// 30_000ms cap + small margin
		await vi.advanceTimersByTimeAsync(30_001);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
