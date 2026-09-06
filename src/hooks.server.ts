// Purpose: Attach baseline HTTP security headers to every server-rendered response.
// Why: The app shipped with no hooks.server.ts, so the only header protecting a
//      visitor was the Strict-Transport-Security one Vercel adds at its edge.
//      Nothing declared framing, MIME-sniffing, referrer or permissions policy,
//      which left the site embeddable in any attacker's iframe. The Content
//      Security Policy itself is configured separately, via `kit.csp` in
//      svelte.config.js, so SvelteKit can manage its own inline-script nonces.
// Scope: this hook only sees responses the SvelteKit function renders. Static
//      files do not reach it: the adapter's generated route table places
//      `{"handle":"filesystem"}` ahead of the SSR rewrites, so /_app/immutable
//      assets, /service-worker.js and everything under static/ are served before
//      the function runs. `vercel.json` carries the headers for those paths; the
//      two must be changed together.
// Scope, since every page route became prerendered: that list is no longer just
//      assets. All fourteen documents are written to disk at build time and are
//      therefore served by the filesystem layer too, so this hook now covers only
//      /api routes, the `SLUG_ALIASES` under /m/ that `prerender = 'auto'` leaves
//      dynamic, and the catchall that renders +error.svelte. `vercel.json` names
//      each prerendered document path explicitly and `tests/unit/security-headers.test.ts`
//      derives that list from the routes' own `prerender` flags, so a new
//      prerendered route without headers fails the suite instead of silently
//      shipping a frameable page. It names paths rather than /(.*) for the reason
//      below: a path this hook still serves must not also match, or the header is
//      set twice.
// Note: `vercel.json` has no header comment of its own because Vercel validates
//      it against a strict schema that rejects any unknown property, a `"//"`
//      documentation key included - that was tried and it failed the deployment.
//      Its rationale therefore lives here and in DECISIONS.md: the sources name
//      only filesystem-served prefixes rather than /(.*), because matching
//      documents too would repeat the headers set below, and a duplicated
//      X-Frame-Options is ignored outright by some browsers. HSTS is omitted
//      there because Vercel's edge already sets it, and the Content Security
//      Policy because it is document-scoped and nonce-managed by SvelteKit.
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
