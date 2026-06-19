// Purpose: Probe real behavior for RateLimitSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { RateLimitCheckRequest, RateLimitSeam } from './contract';

export const probeRateLimitSeam = (
	seam: RateLimitSeam,
	request: RateLimitCheckRequest
) => seam.checkAndConsume(request);
