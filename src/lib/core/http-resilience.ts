// Purpose: Shared HTTP resilience primitives for timeout guards, retry backoff, and a
//          circuit breaker.
// Why: Outbound fetch calls must not hang indefinitely, retryable failures need bounded,
//      caller-aware retry behavior without duplicating AbortController wiring, and a
//      prolonged outage must fail fast instead of re-trying a dead upstream on every call.
// Info flow: adapter fetch task -> circuit breaker gate -> timeout/retry wrapper -> Response or typed error.

// Exported so callers that bypass fetchWithRetry (e.g. a single fetchWithTimeout call) can
// still classify a response consistently when feeding a shared CircuitBreaker.
export const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// Cap for our own jittered exponential backoff (no server guidance available).
const MAX_SELF_BACKOFF_MS = 30_000;
// Cap for a server-supplied Retry-After value. Larger than MAX_SELF_BACKOFF_MS — a server
// explicitly asking us to wait is a stronger signal than our own guess — but still bounded
// well under the request's own per-attempt timeout budget (60s/120s, see CHAT_TIMEOUT_MS/
// IMAGE_TIMEOUT_MS in provider-adapter.adapter.ts). A prior version of this cap was 10
// minutes, which let a single Retry-After sleep hold a serverless request open far past any
// realistic function/route timeout; honoring the header up to a minute keeps the "respect
// the server's guidance" intent without risking that.
const MAX_RETRY_AFTER_MS = 60 * 1000;

const buildNamedError = (name: 'AbortError' | 'TimeoutError' | 'CircuitOpenError', message: string): Error =>
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

const capSelfBackoffMs = (ms: number): number => Math.min(Math.max(0, ms), MAX_SELF_BACKOFF_MS);
const capRetryAfterMs = (ms: number): number => Math.min(Math.max(0, ms), MAX_RETRY_AFTER_MS);

// Spread +/-20% jitter over the nominal delay to avoid simultaneous retries.
const withJitter = (ms: number): number => ms * (0.8 + Math.random() * 0.4);

// Parses Retry-After as either delay seconds or an RFC-1123 HTTP date.
const parseRetryAfterMs = (header: string | null): number => {
	if (header === null) return NaN;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) {
		return capRetryAfterMs(seconds * 1000);
	}
	const dateMs = Date.parse(header) - Date.now();
	if (Number.isFinite(dateMs)) {
		return capRetryAfterMs(dateMs);
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

export const isCircuitOpenError = (error: unknown): boolean => errorName(error) === 'CircuitOpenError';

export type CircuitBreakerOptions = {
	/** Consecutive failures required to open the circuit. */
	failureThreshold: number;
	/** How long the circuit stays open (failing fast) before allowing a trial request. */
	cooldownMs: number;
	/** Injectable clock for deterministic tests; defaults to Date.now. */
	now?: () => number;
};

export type CircuitBreaker = {
	/** True while the circuit is open and the cooldown has not yet elapsed. */
	isOpen: () => boolean;
	/** Record a call that reached the upstream and was treated as healthy. */
	recordSuccess: () => void;
	/** Record a call that failed in a way that indicates upstream trouble (not a caller abort). */
	recordFailure: () => void;
};

// Simplified two-state breaker (closed/open), not a full closed/open/half-open machine: once
// the cooldown elapses, isOpen() simply returns false again and the next caller's request is
// the trial. There is no separate limiter on concurrent trial requests, so a burst of callers
// right as the cooldown elapses can all attempt a trial at once instead of a single probe
// gating the rest. Documented tradeoff — acceptable for this adapter's call volume; revisit if
// a half-open state with bounded trial concurrency is ever needed.
export const createCircuitBreaker = (options: CircuitBreakerOptions): CircuitBreaker => {
	const { failureThreshold, cooldownMs, now = Date.now } = options;
	if (!Number.isFinite(failureThreshold) || !Number.isInteger(failureThreshold) || failureThreshold < 1) {
		throw new Error('createCircuitBreaker: failureThreshold must be a finite integer >= 1');
	}
	if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
		throw new Error('createCircuitBreaker: cooldownMs must be finite and >= 0');
	}

	let consecutiveFailures = 0;
	let openUntil = 0;

	// Shared by isOpen/recordFailure so a stale, already-cooled-down failure count is never
	// built on top of — a caller that records a failure without checking isOpen() first (as
	// well as isOpen() itself) must see a fresh count once the cooldown has elapsed.
	const checkCooldown = () => {
		if (openUntil > 0 && now() >= openUntil) {
			consecutiveFailures = 0;
			openUntil = 0;
		}
	};

	return {
		isOpen: () => {
			checkCooldown();
			return openUntil !== 0;
		},
		recordSuccess: () => {
			consecutiveFailures = 0;
			openUntil = 0;
		},
		recordFailure: () => {
			checkCooldown();
			consecutiveFailures += 1;
			if (consecutiveFailures >= failureThreshold) {
				openUntil = now() + cooldownMs;
			}
		}
	};
};

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
	/**
	 * Optional shared circuit breaker. When open, fails fast without attempting a fetch.
	 * fetchWithRetry only records *failures* it can observe directly (transport errors,
	 * retryable HTTP statuses) — it never records success, since it returns the Response
	 * before the caller has read the body, and a stalled/dropped body read is itself
	 * evidence of upstream trouble. Callers must call `breaker.recordSuccess()` themselves
	 * once they have finished consuming the response — and only for a healthy (`response.ok`)
	 * result. fetchWithRetry can also return a retryable-status (429/5xx) Response as-is once
	 * attempts are exhausted or the breaker opens mid-loop, instead of throwing; recording
	 * success unconditionally after reading such a response's body would immediately undo the
	 * failure fetchWithRetry already recorded for it.
	 */
	breaker?: CircuitBreaker;
};

export const fetchWithRetry = async (
	fetcher: () => Promise<Response>,
	{ maxAttempts, baseDelayMs, signal, breaker }: RetryOptions
): Promise<Response> => {
	if (!Number.isFinite(maxAttempts) || !Number.isInteger(maxAttempts) || maxAttempts < 1) {
		throw new Error('fetchWithRetry: maxAttempts must be a finite integer >= 1');
	}
	if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
		throw new Error('fetchWithRetry: baseDelayMs must be finite and >= 0');
	}

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		// Checked at the top of every attempt, not just once before the loop: a concurrent
		// request sharing this breaker can trip it open while this call is asleep between
		// retries, and that must stop the next attempt just as reliably as a failure this
		// call recorded itself.
		if (breaker?.isOpen()) {
			// A caller-aborted request must surface as AbortError even when the breaker is open.
			if (signal?.aborted) {
				throw buildNamedError('AbortError', 'Operation aborted by caller.');
			}
			throw buildNamedError('CircuitOpenError', 'Circuit breaker is open; failing fast without a request.');
		}

		let response: Response;

		try {
			response = await fetcher();
		} catch (error) {
			const callerAborted = signal?.aborted ?? false;
			if (!callerAborted && !isAbortError(error)) {
				breaker?.recordFailure();
			}
			if (
				(isAbortError(error) || isTimeoutError(error)) &&
				!callerAborted &&
				attempt < maxAttempts &&
				!breaker?.isOpen()
			) {
				await sleep(capSelfBackoffMs(withJitter(baseDelayMs * 2 ** (attempt - 1))), signal);
				continue;
			}
			throw error;
		}

		if (RETRYABLE_STATUSES.has(response.status)) {
			breaker?.recordFailure();
			// A failure that just tripped the breaker must stop retrying immediately rather
			// than schedule another attempt the next loop iteration would fail fast on anyway.
			if (attempt < maxAttempts && !breaker?.isOpen()) {
				response.body?.cancel().catch(() => undefined);
				const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
				const delayMs = Number.isFinite(retryAfterMs)
					? retryAfterMs
					: capSelfBackoffMs(withJitter(baseDelayMs * 2 ** (attempt - 1)));
				await sleep(delayMs, signal);
				continue;
			}
			return response;
		}

		// Success is not recorded here: the caller has not yet read the body, and a
		// stalled/dropped read afterward is still evidence of upstream trouble. See the
		// `breaker` field doc above.
		return response;
	}

	throw new Error('fetchWithRetry: exhausted all attempts');
};
