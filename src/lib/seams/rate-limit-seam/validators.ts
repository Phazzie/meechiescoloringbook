// Purpose: Validate RateLimitSeam inputs.
// Why: Catch empty keys and non-positive limit/window configuration before they reach the counter.
// Info flow: adapter/mock -> validators -> typed values or thrown TypeErrors.

export const validateRateLimitKey = (input: unknown): string => {
	if (typeof input !== 'string' || input.length === 0) {
		throw new TypeError('Rate limit key must not be empty.');
	}
	return input;
};

export const validateRateLimitConfig = (input: unknown): { limit: number; windowMs: number } => {
	if (typeof input !== 'object' || input === null) {
		throw new TypeError('Rate limit config must be an object.');
	}
	const { limit, windowMs } = input as { limit?: unknown; windowMs?: unknown };
	if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
		throw new TypeError('Rate limit config.limit must be a positive integer.');
	}
	if (typeof windowMs !== 'number' || !Number.isInteger(windowMs) || windowMs <= 0) {
		throw new TypeError('Rate limit config.windowMs must be a positive integer.');
	}
	return { limit, windowMs };
};
