// Purpose: Shared HTTP resilience primitives — timeout guard and exponential-backoff retry.
// Why: Outbound fetch calls must not hang indefinitely on stalled APIs, and transient
//      rate-limit (429) or server (5xx) errors should be retried before surfacing a failure.
//      Centralising this avoids duplicating AbortController wiring across every adapter.

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 30_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Spread ±20% jitter over the nominal delay to avoid thundering-herd on simultaneous retries.
const withJitter = (ms: number): number => ms * (0.8 + Math.random() * 0.4);

/**
 * Returns true when the thrown error is an AbortController abort signal.
 * Works for both browser DOMException and Node's undici AbortError.
 */
export const isAbortError = (error: unknown): boolean =>
	error instanceof Error && error.name === 'AbortError';

/**
 * Wraps fetch with an AbortController-based timeout.
 * Preserves any AbortSignal passed in `init` so both timeout and caller
 * cancellation are honoured — whichever fires first aborts the request.
 * Throws an AbortError (name === 'AbortError') if timeoutMs elapses before the
 * response headers arrive.  Callers must catch this and map it to their seam's
 * network-error code.
 */
export const fetchWithTimeout = (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
	const controller = new AbortController();
	const upstreamSignal = init.signal;
	const onUpstreamAbort = () => controller.abort();

	if (upstreamSignal?.aborted) {
		controller.abort();
	} else {
		upstreamSignal?.addEventListener('abort', onUpstreamAbort, { once: true });
	}

	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return fetch(url, { ...init, signal: controller.signal }).finally(() => {
		clearTimeout(timer);
		upstreamSignal?.removeEventListener('abort', onUpstreamAbort);
	});
};

export type RetryOptions = {
	/** Total number of attempts (including the first).  maxAttempts=3 → up to 2 retries. */
	maxAttempts: number;
	/** Base delay before the first retry in milliseconds.  Doubles each subsequent attempt. */
	baseDelayMs: number;
};

/**
 * Calls fetcher() and, on retryable responses or AbortErrors, backs off and retries.
 *
 * Retry policy:
 *   – Retries on HTTP status codes: 429, 500, 502, 503, 504
 *   – Retries on AbortError (request timeout)
 *   – Does NOT retry on other thrown errors (network errors beyond timeout, etc.)
 *   – Respects the Retry-After response header on 429; supports both delta-seconds
 *     and RFC-1123 HTTP-date formats; caps at MAX_RETRY_AFTER_MS
 *   – Drains the response body before retrying to avoid connection leaks
 *   – Delay between retries: jittered exponential backoff (baseDelayMs * 2^(attempt-1))
 *
 * Non-retryable status codes (e.g. 400, 401, 403) are returned immediately on the
 * first attempt — the caller must still check response.ok.
 */
export const fetchWithRetry = async (
	fetcher: () => Promise<Response>,
	{ maxAttempts, baseDelayMs }: RetryOptions
): Promise<Response> => {
	if (maxAttempts < 1) throw new Error('fetchWithRetry: maxAttempts must be >= 1');
	if (baseDelayMs < 0) throw new Error('fetchWithRetry: baseDelayMs must be >= 0');

	let lastAbortError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		let response: Response;

		try {
			response = await fetcher();
		} catch (error) {
			if (isAbortError(error) && attempt < maxAttempts) {
				lastAbortError = error;
				await sleep(withJitter(baseDelayMs * Math.pow(2, attempt - 1)));
				continue;
			}
			throw error;
		}

		if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
			// Drain the response body to release the connection before sleeping.
			await response.body?.cancel().catch(() => {});

			const retryAfterHeader = response.headers.get('Retry-After');
			let retryAfterMs = NaN;
			if (retryAfterHeader !== null) {
				const asSeconds = Number(retryAfterHeader);
				if (Number.isFinite(asSeconds) && asSeconds >= 0) {
					retryAfterMs = Math.min(asSeconds * 1000, MAX_RETRY_AFTER_MS);
				} else {
					// Try parsing as an HTTP-date (RFC 1123).
					const dateMs = Date.parse(retryAfterHeader) - Date.now();
					if (Number.isFinite(dateMs)) {
						retryAfterMs = Math.min(Math.max(0, dateMs), MAX_RETRY_AFTER_MS);
					}
				}
			}
			const delayMs = Number.isFinite(retryAfterMs)
				? retryAfterMs
				: withJitter(baseDelayMs * Math.pow(2, attempt - 1));
			await sleep(delayMs);
			continue;
		}

		return response;
	}

	// We only reach here when every attempt was an AbortError.
	throw lastAbortError ?? new Error('fetchWithRetry: exhausted all attempts');
};
