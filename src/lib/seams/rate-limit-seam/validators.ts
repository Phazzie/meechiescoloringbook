// Purpose: Validate RateLimitSeam inputs.
// Why: Catch malformed keys/limits/windows/clock readings before they reach the limiter algorithm.
// Info flow: limiter/mock -> validators -> typed values or thrown ZodError.
import { RateLimitCheckInputSchema, type RateLimitCheckInput } from './contract';

export const validateRateLimitCheckInput = (input: unknown): RateLimitCheckInput =>
	RateLimitCheckInputSchema.parse(input);
