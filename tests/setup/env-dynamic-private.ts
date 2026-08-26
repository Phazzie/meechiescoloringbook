// Purpose: Provide Vitest with the private dynamic-environment module exposed by SvelteKit at runtime.
// Why: Let integration tests compose production config adapters without loading credentials or SvelteKit.
// Info flow: process.env -> aliased $env/dynamic/private export -> production config adapters.
export const env: Record<string, string | undefined> = process.env;
