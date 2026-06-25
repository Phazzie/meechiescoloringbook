// Purpose: Probe real behavior for RateLimitConfigSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { RateLimitConfigSeam } from './contract';

export const probeRateLimitConfigSeam = (seam: RateLimitConfigSeam) => seam.getConfig();
