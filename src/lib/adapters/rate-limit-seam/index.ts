// Purpose: Implement RateLimitSeam using an in-memory sliding-window counter.
// Why: Bound calls to paid AI-provider-backed endpoints per client without adding new
//      external infrastructure; state lives per warm serverless instance.
// Info flow: route call -> in-memory Map<key, timestamps[]> -> pure evaluate() -> Result<>.
import type { RateLimitRule, RateLimitSeam } from '../../seams/rate-limit-seam/contract';
import { evaluate } from '../../seams/rate-limit-seam/window';

export const createRateLimitSeam = (rule: RateLimitRule): RateLimitSeam => {
	const store = new Map<string, number[]>();

	return {
		checkAndConsume: (key, now) => {
			const { result, nextTimestamps } = evaluate(store.get(key) ?? [], rule, now);
			if (nextTimestamps.length === 0) {
				store.delete(key);
			} else {
				store.set(key, nextTimestamps);
			}
			return result;
		}
	};
};
