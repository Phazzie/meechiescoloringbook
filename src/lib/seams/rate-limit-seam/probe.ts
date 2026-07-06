// Purpose: Probe real behavior for RateLimitSeam.
// Why: RateLimitSeam is pure/deterministic given (key, now); this demonstrates the seam's
//      documented behavior instead of capturing fixtures from a live external system.
// Info flow: seam calls with fixed clock values -> recorded decisions.
import type { RateLimitRule, RateLimitSeam } from './contract';

export const probeRateLimitSeam = (seam: RateLimitSeam, rule: RateLimitRule, key: string) => {
	const start = 0;
	const decisions = [];
	for (let i = 0; i < rule.limit + 1; i += 1) {
		decisions.push(seam.checkAndConsume(key, start + i));
	}
	const afterWindow = seam.checkAndConsume(key, start + rule.windowMs + 1);
	return { withinLimit: decisions.slice(0, rule.limit), overLimit: decisions[rule.limit], afterWindow };
};
