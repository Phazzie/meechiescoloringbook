// Purpose: Validate AppOriginSeam output.
// Why: The origin decides whether a stored URL becomes an `<img src>` and a clickable `<a href>`.
//      A malformed or non-http(s) value must never reach that comparison, because an attacker-
//      controlled stored URL that happened to match it would be treated as same-origin.
// Info flow: adapter/mock -> validators -> a checked origin, or ''.
import { z } from 'zod';

/** An http(s) origin with no path, query, fragment, or trailing slash — or '' for "none". */
export const appOriginSchema = z.string().refine((value) => {
	if (value.length === 0) return true;
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
		// `URL.origin` is exactly this shape, so anything else means the value was not an origin.
		return parsed.origin === value;
	} catch {
		return false;
	}
}, 'Expected an http(s) origin such as "https://example.com", or "" for no origin.');

/**
 * Returns the origin when it is a well-formed http(s) origin, and '' otherwise. Deliberately does
 * not throw: an unusable origin should degrade to "no origin known" — which makes the same-origin
 * check refuse every absolute URL — rather than break the page.
 */
export const toSafeOrigin = (value: string | null | undefined): string =>
	appOriginSchema.safeParse(value ?? '').success ? (value ?? '') : '';
