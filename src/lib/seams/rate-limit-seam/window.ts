// Purpose: Pure sliding-window rate-limit evaluation logic.
// Why: Keep the counting algorithm deterministic and independently testable, separate from
//      where call timestamps are stored (in-memory Map in the real adapter).
// Info flow: stored timestamps + rule + now -> evaluate() -> decision + pruned timestamps.
import type { Result } from '../../../../contracts/shared.contract';
import type { RateLimitError, RateLimitRule } from './contract';

export type RateLimitEvaluation = {
	result: Result<undefined, RateLimitError>;
	nextTimestamps: number[];
};

const withinWindow = (timestamp: number, now: number, windowMs: number): boolean =>
	now - timestamp < windowMs;

export const evaluate = (
	timestamps: number[],
	rule: RateLimitRule,
	now: number
): RateLimitEvaluation => {
	const kept = timestamps.filter((timestamp) => withinWindow(timestamp, now, rule.windowMs));

	if (kept.length >= rule.limit) {
		const oldest = kept[0];
		const retryAfterMs = Math.max(0, rule.windowMs - (now - oldest));
		return {
			result: {
				ok: false,
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: 'Too many requests. Please try again shortly.',
					retryAfterMs
				}
			},
			nextTimestamps: kept
		};
	}

	return {
		result: { ok: true, value: undefined },
		nextTimestamps: [...kept, now]
	};
};
