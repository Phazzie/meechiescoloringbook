// Purpose: Probe real behavior for RateLimitSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { RateLimitCheckInput, RateLimitSeam } from './contract';

export const probeRateLimitSeam = (seam: RateLimitSeam, input: RateLimitCheckInput) =>
  seam.check(input);
