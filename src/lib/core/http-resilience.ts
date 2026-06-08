// Purpose: Shared HTTP resilience primitives for timeout guards and retry backoff.
// Why: Outbound fetch calls must not hang indefinitely, and retryable failures need
//      bounded, caller-aware retry behavior without duplicating AbortController wiring.
// Info flow: adapter fetch task -> timeout/retry wrapper -> Response or typed error.

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 30_000;

const buildNamedError = (name: 'AbortError' | 'TimeoutError', message: string): Error =>
	Object.assign(new Error(message), { name });

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(buildNamedError('AbortError', 'Operation aborted by caller.'));
			return;
		}

		let timer: ReturnType<typeof setTimeout>;
		const onAbort = () => {
			clearTimeout(timer);
			reject(buildNamedError('AbortError', 'Operation aborted by caller.'));
		};
		timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', onAbort, { once: true });
	});

const capDelayMs = (ms: number): number => Math.min(Math.max(0, ms), MAX_RETRY_AFTER_MS);

// Spread +/-20% jitter over the nominal delay to avoid simultaneous retries.
const withJitter = (ms: number): number => ms * (0.8 + Math.random() * 0.4);

// Parses Retry-After as either delay seconds or an RFC-1123 HTTP date.
const parseRetryAfterMs = (header: string | null): number => {
	if (header === null) return NaN;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) {
		return capDelayMs(seconds * 1000);
	}
	const dateMs = Date.parse(header) - Date.now();
	if (Number.isFinite(dateMs)) {
		return capDelayMs(dateMs);
	}
	return NaN;
};

const errorName = (error: unknown): unknown =>
	typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export const isAbortError = (error: unknown): boolean => errorName(error) === 'AbortError';

export const isTimeoutError = (error: unknown): boolean =>
	errorName(error) === 'TimeoutError' || /timed out/i.test(errorMessage(error));

export type TimeoutSignalOptions = {
	signal?: AbortSignal;
	timeoutMessage?: string;
};

export const runWithTimeoutSignal = async <T>(
	task: (signal: AbortSignal) => Promise<T>,
	timeoutMs: number,
	options: TimeoutSignalOptions = {}
): Promise<T> => {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		throw new Error('runWithTimeoutSignal: timeoutMs must be finite and > 0');
	}

	const controller = new AbortController();
	const upstreamSignal = options.signal;
	const timeoutMessage = options.timeoutMessage ?? `Operation timed out after ${timeoutMs}ms.`;
	let timedOut = false;
	let upstreamAborted = upstreamSignal?.aborted ?? false;

	const onUpstreamAbort = () => {
		upstreamAborted = true;
		controller.abort();
	};

	if (upstreamAborted) {
		controller.abort();
	} else {
		upstreamSignal?.addEventListener('abort', onUpstreamAbort, { once: true });
	}

	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);

	try {
		return await task(controller.signal);
	} catch (error) {
		if (timedOut && (isAbortError(error) || isTimeoutError(error))) {
			throw buildNamedError('TimeoutError', timeoutMessage);
		}
		if (upstreamAborted && isAbortError(error)) {
			throw buildNamedError('AbortError', 'Operation aborted by caller.');
		}
		throw error;
	} finally {
		clearTimeout(timer);
		upstreamSignal?.removeEventListener('abort', onUpstreamAbort);
	}
};

export const fetchWithTimeout = (url: string, init: RequestInit, timeoutMs: number): Promise<Response> =>
	runWithTimeoutSignal((signal) => fetch(url, { ...init, signal }), timeoutMs, {
		signal: init.signal ?? undefined,
		timeoutMessage: `Request timed out after ${timeoutMs}ms.`
	});

export type RetryOptions = {
	/** Total number of attempts including the first. maxAttempts=3 means up to 2 retries. */
	maxAttempts: number;
	/** Base delay before the first retry in milliseconds. Doubles each retry. */
	baseDelayMs: number;
	/** Optional caller cancellation signal; caller aborts are never retried. */
	signal?: AbortSignal;
};

export const fetchWithRetry = async (
	fetcher: () => Promise<Response>,
	{ maxAttempts, baseDelayMs, signal }: RetryOptions
): Promise<Response> => {
	if (!Number.isFinite(maxAttempts) || !Number.isInteger(maxAttempts) || maxAttempts < 1) {
		throw new Error('fetchWithRetry: maxAttempts must be a finite integer >= 1');
	}
	if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
		throw new Error('fetchWithRetry: baseDelayMs must be finite and >= 0');
	}

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		let response: Response;

		try {
			response = await fetcher();
		} catch (error) {
			const callerAborted = signal?.aborted ?? false;
			if ((isAbortError(error) || isTimeoutError(error)) && !callerAborted && attempt < maxAttempts) {
				await sleep(capDelayMs(withJitter(baseDelayMs * 2 ** (attempt - 1))), signal);
				continue;
			}
			throw error;
		}

		if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
			response.body?.cancel().catch((err: unknown) => {
				const message = errorMessage(err);
				if (!/aborted|canceled/i.test(message)) {
					console.error('fetchWithRetry: failed to cancel response body:', message);
				}
			});
			const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
			const delayMs = Number.isFinite(retryAfterMs)
				? retryAfterMs
				: capDelayMs(withJitter(baseDelayMs * 2 ** (attempt - 1)));
			await sleep(delayMs, signal);
			continue;
		}

		return response;
	}

	throw new Error('fetchWithRetry: exhausted all attempts');
};
