// Purpose: Define the AppOriginSeam contract — the origin the application is being served from.
// Why: `AGENTS.md` classifies OS/browser integration as a seam. Deciding whether a stored image URL
//      is same-origin (and therefore loadable under the app's `img-src 'self'` policy) needs to know
//      that origin, and reading `location.origin` straight from the host would put that decision
//      outside any boundary and make it undrivable from a test.
// Info flow: caller -> AppOriginSeam -> real `location` (adapter) or a fixed origin (mock).

/**
 * Reading an origin cannot fail: where there is no browser — a server render, a unit test — the
 * answer is simply "no origin", which callers already have to handle. The contract therefore
 * returns a plain string rather than `Result<>`, and is synchronous.
 */
export type AppOriginSeam = {
	/**
	 * The scheme, host and port the app is served from, e.g. `https://meechie.example`. Empty
	 * string where there is no browser origin at all; never a trailing slash.
	 */
	getOrigin(): string;
};
