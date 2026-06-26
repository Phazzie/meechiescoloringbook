// Purpose: Log missing required/optional env vars once when the server process starts.
// Why: Without this, the app boots silently and a missing XAI_API_KEY only surfaces as a
//      500 on the first real image-generation request instead of in startup logs.
// Info flow: $env/dynamic/private -> checkStartupEnv (core, pure) -> console diagnostics.
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { checkStartupEnv } from '$lib/core/startup-env-check';

const { missingRequired, missingOptional } = checkStartupEnv(env);

for (const envVar of missingRequired) {
	console.error(
		`[startup] Missing required env var ${envVar.key} — ${envVar.feature} will fail at request time until it is set.`
	);
}

for (const envVar of missingOptional) {
	console.warn(
		`[startup] Missing optional env var ${envVar.key} — ${envVar.feature} will be degraded/disabled until it is set.`
	);
}

export const handle: Handle = async ({ event, resolve }) => resolve(event);
