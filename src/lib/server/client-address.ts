// Purpose: Safely resolve a rate-limit key from SvelteKit's getClientAddress().
// Why: getClientAddress() can throw (e.g. an unsupported adapter/platform, or a misconfigured
//      proxy); an uncaught throw would crash the route with a non-JSON 500 instead of the
//      route's normal contract-shaped error responses.
// Info flow: RequestEvent.getClientAddress -> safe string key (shared 'unknown' bucket on throw).
export const safeClientAddress = (getClientAddress: () => string): string => {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
};
