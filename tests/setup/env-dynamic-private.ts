// Purpose: Resolve SvelteKit's `$env/dynamic/private` for integration test runs.
// Why: Integration tests import real adapters, which read private env through that
//      alias. Vitest has no SvelteKit plugin in the integration config, so without a
//      shim the whole suite fails at import and no integration test can run at all.
// Info flow: process.env -> this shim -> adapters under integration test.
export const env = process.env as Record<string, string | undefined>;
