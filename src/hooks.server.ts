// Purpose: Attach baseline HTTP security headers to every response the app sends.
// Why: The app shipped with no hooks.server.ts, so the only header protecting a
//      visitor was the Strict-Transport-Security one Vercel adds at its edge.
//      Nothing declared framing, MIME-sniffing, referrer or permissions policy,
//      which left the site embeddable in any attacker's iframe. The Content
//      Security Policy itself is configured separately, via `kit.csp` in
//      svelte.config.js, so SvelteKit can manage its own inline-script nonces.
// Info flow: Request -> handle() -> resolve() -> headers attached -> response.
import type { Handle } from '@sveltejs/kit';

// Strict-Transport-Security is repeated here rather than left to Vercel so the
// guarantee travels with the application if it is ever hosted somewhere else.
export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
	['X-Content-Type-Options', 'nosniff'],
	['X-Frame-Options', 'DENY'],
	['Referrer-Policy', 'strict-origin-when-cross-origin'],
	['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
	['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload']
];

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of SECURITY_HEADERS) {
		response.headers.set(name, value);
	}
	return response;
};
