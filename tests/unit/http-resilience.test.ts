// Purpose: Unit tests for http-resilience fetch utilities.
// Why: Timeout and retry logic must be verified deterministically with fake timers;
//      real network calls would make these tests slow and flaky.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	fetchWithTimeout,
	fetchWithRetry,
	isAbortError,
	isTimeoutError,
	isTimeoutMessage
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
// isTimeoutMessage / isTimeoutError
//
// This is the single canonical timeout classifier. generate-pipeline.ts and
// meechie-studio-text-pipeline.ts previously each hand-rolled their own regex
// here (/timeout/i and /\b(timeout|timed out)\b/i respectively) which could
// disagree with this module's own /timed out/i check on the same message
// (e.g. a bare "Provider timeout" message). All three now defer to this one
// pattern, so these tests pin down what counts as a timeout for everyone.
// ---------------------------------------------------------------------------

describe('isTimeoutMessage', () => {
	it('matches the single word "timeout"', () => {
		expect(isTimeoutMessage('Provider timeout')).toBe(true);
	});

	it('matches the two-word phrase "timed out"', () => {
		expect(isTimeoutMessage('Chat completion request timed out.')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(isTimeoutMessage('REQUEST TIMED OUT')).toBe(true);
	});

	it('does not match unrelated messages', () => {
		expect(isTimeoutMessage('ECONNREFUSED')).toBe(false);
		expect(isTimeoutMessage('adapter exploded')).toBe(false);
	});
});

describe('isTimeoutError', () => {
	it('returns true for an Error named TimeoutError regardless of message', () => {
		const error = Object.assign(new Error('boom'), { name: 'TimeoutError' });
		expect(isTimeoutError(error)).toBe(true);
	});

	it('returns true for a plain Error whose message contains "timeout"', () => {
		expect(isTimeoutError(new Error('Provider timeout'))).toBe(true);
	});

	it('returns true for a plain Error whose message contains "timed out"', () => {
		expect(isTimeoutError(new Error('provider request timed out'))).toBe(true);
	});

	it('returns false for a plain Error with an unrelated message', () => {
		expect(isTimeoutError(new Error('ECONNREFUSED'))).toBe(false);
	});

	it('returns false for a non-Error value with no timeout signal', () => {
		expect(isTimeoutError('nope')).toBe(false);
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
});
