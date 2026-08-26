// Purpose: Read and validate private durable rate-limit configuration.
// Why: Missing credentials or identity secrets must fail closed before any provider work.
// Info flow: private environment -> validated Upstash/identity settings -> rate-limit guard.
import { env as privateEnv } from '$env/dynamic/private';

export type RateLimitConfig = {
	upstashRestUrl: string;
	upstashRestToken: string;
	identitySecret: string;
	operationTimeoutMs: number;
};

export class RateLimitConfigError extends Error {
	constructor() {
		super('Rate limit configuration is invalid.');
		this.name = 'RateLimitConfigError';
	}
}

const DEFAULT_OPERATION_TIMEOUT_MS = 1_500;

// Strip trailing '/' (char code 47) linearly; a `/\/+$/` regex backtracks
// super-linearly on slash-heavy input.
const stripTrailingSlashes = (value: string): string => {
	let end = value.length;
	while (end > 0 && value.charCodeAt(end - 1) === 47) {
		end -= 1;
	}
	return value.slice(0, end);
};

const required = (value: string | undefined): string => {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new RateLimitConfigError();
	}
	return value;
};

const validRestUrl = (value: string): string => {
	try {
		const parsed = new URL(value);
		if (
			parsed.protocol !== 'https:' ||
			parsed.username.length > 0 ||
			parsed.password.length > 0 ||
			parsed.search.length > 0 ||
			parsed.hash.length > 0
		) {
			throw new RateLimitConfigError();
		}
		return stripTrailingSlashes(parsed.toString());
	} catch {
		throw new RateLimitConfigError();
	}
};

const operationTimeout = (value: string | undefined): number => {
	if (value === undefined || value.trim().length === 0) {
		return DEFAULT_OPERATION_TIMEOUT_MS;
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new RateLimitConfigError();
	}
	return parsed;
};

export const loadRateLimitConfig = (
	environment: Record<string, string | undefined> = privateEnv
): RateLimitConfig => ({
	upstashRestUrl: validRestUrl(required(environment.UPSTASH_REDIS_REST_URL)),
	upstashRestToken: required(environment.UPSTASH_REDIS_REST_TOKEN),
	identitySecret: required(environment.RATE_LIMIT_IDENTITY_SECRET),
	operationTimeoutMs: operationTimeout(environment.RATE_LIMIT_OPERATION_TIMEOUT_MS)
});
