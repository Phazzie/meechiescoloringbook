// Purpose: Build the RateLimitConfigSeam adapter from environment values.
// Why: Read only the 2 rate-limit env keys behind a seam adapter, decoupled from
//      AppConfigSeam — rate limiting must keep working even when unrelated required
//      config (e.g. xaiApiKey) is absent or mocked.
// Info flow: env -> readRateLimitConfig -> RateLimitConfig -> callers.
import type { RateLimitConfigSeam } from '../../seams/rate-limit-config-seam/contract';
import { readRateLimitConfig } from '../../seams/rate-limit-config-seam/validators';
import { env as privateEnv } from '$env/dynamic/private';

export const createRateLimitConfigSeam = (
	env: Record<string, string | undefined> = privateEnv
): RateLimitConfigSeam => ({
	getConfig: () => readRateLimitConfig(env)
});
