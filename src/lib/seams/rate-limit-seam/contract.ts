// Purpose: Define the asynchronous durable RateLimitSeam contract.
// Why: Keep quota consumption atomic, provider-independent, and fail-closed.
// Info flow: pseudonymous identity + policy cost -> durable store -> quota decision or stable error.
import type { Result } from '../../../../contracts/shared.contract';
import type {
	RateLimitBucket,
	RateLimitConsumeInput,
	RateLimitDecision
} from './validators';

export type { RateLimitBucket, RateLimitConsumeInput, RateLimitDecision };

export type RateLimitError =
	| { code: 'RATE_LIMIT_VALIDATION_ERROR'; message: string }
	| { code: 'RATE_LIMIT_STORE_ERROR'; message: string }
	| { code: 'RATE_LIMIT_TIMEOUT'; message: string };

export type RateLimitSeam = {
	consume: (
		input: RateLimitConsumeInput
	) => Promise<Result<RateLimitDecision, RateLimitError>>;
};
