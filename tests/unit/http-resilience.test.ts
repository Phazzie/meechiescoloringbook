// Purpose: Unit tests for http-resilience fetch utilities.
// Why: Timeout and retry logic must be verified deterministically with fake timers;
//      real network calls would make these tests slow and flaky.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchWithTimeout,
	fetchWithRetry,
	isAbortError,
	isTimeoutError
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
// isTimeoutError
// ---------------------------------------------------------------------------

describe('isTimeoutError', () => {
	it('returns true for an Error named TimeoutError', () => {
		const error = Object.assign(new Error('boom'), { name: 'TimeoutError' });
		expect(isTimeoutError(error)).toBe(true);
	});

	it('returns true for a message containing "timed out"', () => {
		expect(isTimeoutError(new Error('Request timed out after 5000ms.'))).toBe(true);
	});

	it('returns true for a message containing "timeout" without "timed out"', () => {
		expect(isTimeoutError(new Error('Network timeout'))).toBe(true);
	});

	it('returns false for an unrelated error', () => {
		expect(isTimeoutError(new Error('ECONNREFUSED'))).toBe(false);
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

	it('does not retry AbortError when the caller signal is already aborted', async () => {
		const caller = new AbortController();
		caller.abort();
		const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
		const fetcher = vi.fn().mockRejectedValue(abortError);
		const options = {
			maxAttempts: 3,
			baseDelayMs: 100,
			signal: caller.signal
		} as Parameters<typeof fetchWithRetry>[1];

		const rejection = fetchWithRetry(fetcher, options).catch((error) => error);
		await vi.runAllTimersAsync();

		await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
		expect(fetcher).toHaveBeenCalledTimes(1);
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

	it('caps Retry-After at 30 seconds', async () => {
		const longRetryHeaders = new Headers({ 'Retry-After': '3600' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: longRetryHeaders }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const promise = fetchWithRetry(fetcher, { maxAttempts: 2, baseDelayMs: 50 });
		await vi.advanceTimersByTimeAsync(30_001);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('invokes onResponseBodyCancelError with the original error for non-abort/cancel body cancel failures', async () => {
		const cancelError = new Error('boom');
		const response = {
			status: 503,
			headers: new Headers(),
			body: { cancel: vi.fn().mockRejectedValue(cancelError) }
		} as unknown as Response;
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(response)
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		const onResponseBodyCancelError = vi.fn();

		const promise = fetchWithRetry(fetcher, {
			maxAttempts: 2,
			baseDelayMs: 100,
			onResponseBodyCancelError
		});
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(onResponseBodyCancelError).toHaveBeenCalledWith(cancelError);
	});

	it('does not invoke onResponseBodyCancelError when the body cancel fails with an abort-like error', async () => {
		const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
		const response = {
			status: 503,
			headers: new Headers(),
			body: { cancel: vi.fn().mockRejectedValue(abortError) }
		} as unknown as Response;
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(response)
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		const onResponseBodyCancelError = vi.fn();

		const promise = fetchWithRetry(fetcher, {
			maxAttempts: 2,
			baseDelayMs: 100,
			onResponseBodyCancelError
		});
		await vi.runAllTimersAsync();
		await promise;

		expect(onResponseBodyCancelError).not.toHaveBeenCalled();
	});

	it('does not let a throwing onResponseBodyCancelError callback break the retry flow', async () => {
		const cancelError = new Error('boom');
		const response = {
			status: 503,
			headers: new Headers(),
			body: { cancel: vi.fn().mockRejectedValue(cancelError) }
		} as unknown as Response;
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(response)
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		const onResponseBodyCancelError = vi.fn(() => {
			throw new Error('callback exploded');
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const promise = fetchWithRetry(fetcher, {
			maxAttempts: 2,
			baseDelayMs: 100,
			onResponseBodyCancelError
		});
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(onResponseBodyCancelError).toHaveBeenCalledWith(cancelError);
		errorSpy.mockRestore();
	});
});
