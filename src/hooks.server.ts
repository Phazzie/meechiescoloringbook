// Purpose: Attach baseline HTTP security headers to every response.
// Why: The app had no hooks.server.ts, so no clickjacking, MIME-sniffing,
//      referrer, or permissions protections existed on any route. CSP itself
//      is configured separately via `kit.csp` in svelte.config.js.
// Info flow: Request -> handle() -> resolve() -> headers attached -> response sent.
import type { Handle } from '@sveltejs/kit';

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
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
