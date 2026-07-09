// Purpose: Build the real RateLimitSeam adapter over a shared in-memory store and Date.now().
// Why: Give unauthenticated, provider-billed API routes a per-client request budget without
//      adding an external datastore dependency.
// Info flow: route -> checkLimit -> validated input + real clock -> evaluateRateLimit -> decision.
import { evaluateRateLimit, type RateLimitStore } from '../../core/rate-limit';
import type { RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import { validateRateLimitCheckInput } from '../../seams/rate-limit-seam/validators';

// Module-level singleton: persists across requests within the same warm serverless instance.
// This is a best-effort, per-instance mitigation, not a durable multi-instance rate limit — see
// DECISIONS.md for the documented assumption and revisit criteria.
const defaultStore: RateLimitStore = new Map();

export const createRateLimitSeam = (
	store: RateLimitStore = defaultStore,
	clock: () => number = Date.now
): RateLimitSeam => ({
	checkLimit: (input) => {
		let validated;
		try {
			validated = validateRateLimitCheckInput(input);
		} catch {
			return {
				ok: false,
				error: {
					code: 'RATE_LIMIT_INVALID_INPUT',
					message: 'Rate limit check input failed validation.'
				}
			};
		}
		return { ok: true, value: evaluateRateLimit(store, { ...validated, now: clock() }) };
	}
});

export const rateLimitSeam = createRateLimitSeam();
