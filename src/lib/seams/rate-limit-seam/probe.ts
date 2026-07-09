// Purpose: Probe real behavior for RateLimitSeam.
// Why: Capture real outputs to refresh fixtures/evidence.
// Info flow: real adapter -> checkLimit calls -> recorded decisions.
import type { RateLimitSeam } from './contract';

export const probeRateLimitSeam = (seam: RateLimitSeam, key: string, limit: number, windowMs: number) => ({
	first: seam.checkLimit({ key, limit, windowMs }),
	second: seam.checkLimit({ key, limit, windowMs })
});
