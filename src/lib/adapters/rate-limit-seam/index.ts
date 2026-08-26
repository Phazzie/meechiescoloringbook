// Purpose: Implement RateLimitSeam with one atomic Upstash Redis REST operation.
// Why: Serverless instances need shared durable quota state without a process-local Map.
// Info flow: validated consume input -> atomic Lua EVAL -> validated quota decision.
import type {
	RateLimitDecision,
	RateLimitError,
	RateLimitSeam
} from '../../seams/rate-limit-seam/contract';
import {
	validateRateLimitConsumeInput,
	validateRateLimitDecision
} from '../../seams/rate-limit-seam/validators';
import type { Result } from '../../../../contracts/shared.contract';
import {
	isTimeoutError,
	runWithTimeoutSignal
} from '../../core/http-resilience';

export type UpstashRateLimitConfig = {
	restUrl: string;
	restToken: string;
	timeoutMs: number;
};

export type RateLimitAdapterDependencies = {
	fetchImpl?: typeof fetch;
	now?: () => number;
};

const ATOMIC_FIXED_WINDOW_SCRIPT = `
local used = redis.call('INCRBY', KEYS[1], ARGV[1])
if used == tonumber(ARGV[1]) then
  redis.call('PEXPIREAT', KEYS[1], ARGV[2])
end
return {used, tonumber(ARGV[2])}
`.trim();

// Strip trailing '/' (char code 47) linearly; a `/\/+$/` regex backtracks
// super-linearly on slash-heavy input.
const stripTrailingSlashes = (value: string): string => {
	let end = value.length;
	while (end > 0 && value.codePointAt(end - 1) === 47) {
		end -= 1;
	}
	return value.slice(0, end);
};

const errorResult = (
	code: RateLimitError['code'],
	message: string
): Result<RateLimitDecision, RateLimitError> => ({
	ok: false,
	error: { code, message } as RateLimitError
});

const readAtomicResult = (payload: unknown): { used: number; resetAtMs: number } | null => {
	if (typeof payload !== 'object' || payload === null || !('result' in payload)) {
		return null;
	}
	const result = (payload as { result?: unknown }).result;
	if (!Array.isArray(result) || result.length < 2) {
		return null;
	}
	const used = Number(result[0]);
	const resetAtMs = Number(result[1]);
	if (
		!Number.isSafeInteger(used) ||
		used < 0 ||
		!Number.isSafeInteger(resetAtMs) ||
		resetAtMs < 0
	) {
		return null;
	}
	return { used, resetAtMs };
};

export const createRateLimitSeam = (
	config: UpstashRateLimitConfig,
	dependencies: RateLimitAdapterDependencies = {}
): RateLimitSeam => {
	const fetchImpl = dependencies.fetchImpl ?? fetch;
	const now = dependencies.now ?? Date.now;
	const restUrl = stripTrailingSlashes(config.restUrl);

	return {
		consume: async (input) => {
			let validated;
			try {
				validated = validateRateLimitConsumeInput(input);
			} catch {
				return errorResult(
					'RATE_LIMIT_VALIDATION_ERROR',
					'Rate limit operation failed validation.'
				);
			}

			const nowMs = Math.max(0, Math.floor(now()));
			const windowStartMs = Math.floor(nowMs / validated.windowMs) * validated.windowMs;
			const expectedResetAtMs = windowStartMs + validated.windowMs;
			const storageKey = [
				'meechie',
				'rate-limit',
				validated.bucket,
				String(windowStartMs),
				validated.identityKey
			].join(':');

			let responsePayload: unknown;
			try {
				responsePayload = await runWithTimeoutSignal(
					async (signal) => {
						const response = await fetchImpl(restUrl, {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${config.restToken}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify([
								'EVAL',
								ATOMIC_FIXED_WINDOW_SCRIPT,
								'1',
								storageKey,
								String(validated.cost),
								String(expectedResetAtMs)
							]),
							signal
						});
						if (!response.ok) {
							throw new Error('Rate limit store rejected the operation.');
						}
						return response.json();
					},
					config.timeoutMs,
					{ timeoutMessage: 'Rate limit storage timed out.' }
				);
			} catch (error) {
				if (isTimeoutError(error)) {
					return errorResult('RATE_LIMIT_TIMEOUT', 'Rate limit storage timed out.');
				}
				return errorResult('RATE_LIMIT_STORE_ERROR', 'Rate limit storage is unavailable.');
			}

			const atomicResult = readAtomicResult(responsePayload);
			if (!atomicResult || atomicResult.resetAtMs !== expectedResetAtMs) {
				return errorResult('RATE_LIMIT_STORE_ERROR', 'Rate limit storage is unavailable.');
			}

			try {
				return {
					ok: true,
					value: validateRateLimitDecision({
						allowed: atomicResult.used <= validated.limit,
						limit: validated.limit,
						used: atomicResult.used,
						remaining: Math.max(validated.limit - atomicResult.used, 0),
						resetAtMs: atomicResult.resetAtMs
					})
				};
			} catch {
				return errorResult('RATE_LIMIT_STORE_ERROR', 'Rate limit storage is unavailable.');
			}
		}
	};
};
