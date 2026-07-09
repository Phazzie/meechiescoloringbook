// Purpose: Mock RateLimitSeam behavior over a fresh in-memory store with an injectable clock.
// Why: The seam's real behavior is a pure counting algorithm over an injected store and clock,
//      so there is no external I/O to fake; the mock reuses the same pure core with test-controlled
//      time instead of Date.now(). This mirrors the documented PromptCompilerSeam pure-logic exception.
// Info flow: tests -> mock (fresh store + fixed clock) -> evaluateRateLimit -> decision.
import { evaluateRateLimit, type RateLimitStore } from '../../core/rate-limit';
import type { RateLimitSeam } from './contract';
import { validateRateLimitCheckInput, validateRateLimitCheckValue } from './validators';

export const createMockRateLimitSeam = (now = 0, store: RateLimitStore = new Map()): RateLimitSeam => ({
	checkLimit: (input) => {
		try {
			const validated = validateRateLimitCheckInput(input);
			const decision = evaluateRateLimit(store, { ...validated, now });
			return { ok: true, value: validateRateLimitCheckValue(decision) };
		} catch {
			return {
				ok: false,
				error: {
					code: 'RATE_LIMIT_INVALID_INPUT',
					message: 'Rate limit check input failed validation.'
				}
			};
		}
	}
});
