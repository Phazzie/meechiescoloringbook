// Purpose: Shared RateLimitSeam singleton for API routes.
// Why: Routes must share one in-memory limiter instance per warm server process so per-key
//      counters actually accumulate across requests instead of resetting on every call.
// Info flow: module import (once per process) -> singleton limiter -> route consume() calls.
import { createRateLimitSeam } from '$lib/seams/rate-limit-seam/limiter';

export const rateLimitSeam = createRateLimitSeam();
