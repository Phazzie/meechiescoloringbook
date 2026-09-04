// Purpose: Deterministic origins for AppOriginSeam mock and contract tests.
// Why: Same-origin behaviour has to be provable against a fixed origin, not whatever host the
//      suite happens to run on.
// Info flow: fixtures -> mock/tests.

/** The origin the mock reports by default. */
export const sampleOrigin = 'https://meechie.test';

/** A different origin, for proving an off-origin URL is refused. */
export const otherOrigin = 'https://not-meechie.test';

/** No browser origin at all: a server render, or a unit test with no location. */
export const missingOrigin = '';

// --- Fault fixtures: values that must never be accepted as an origin. ---

/** A whole URL rather than an origin; accepting it would widen the same-origin comparison. */
export const originWithPath = 'https://meechie.test/vault/page.png';

/** A trailing slash makes string comparison against `URL.origin` silently fail. */
export const originWithTrailingSlash = 'https://meechie.test/';

/** Not an http(s) scheme, so nothing served from it could ever satisfy `img-src 'self'`. */
export const nonHttpOrigin = 'javascript:alert(1)';

/** Not parseable as a URL at all. */
export const malformedOrigin = 'not an origin';

/** Every value the seam must reject, for table-driven contract tests. */
export const invalidOrigins = [
	originWithPath,
	originWithTrailingSlash,
	nonHttpOrigin,
	malformedOrigin
] as const;
