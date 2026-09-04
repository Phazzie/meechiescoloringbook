// Purpose: Implement AppOriginSeam against the browser location.
// Why: This is the single place in the application permitted to read `location.origin`.
// Info flow: AppOriginSeam.getOrigin() -> globalThis.location.origin -> validated origin or ''.
import type { AppOriginSeam } from '../../seams/app-origin-seam/contract';
import { toSafeOrigin } from '../../seams/app-origin-seam/validators';

export const createAppOriginSeam = (): AppOriginSeam => ({
	getOrigin: () => {
		// No location at all during a server render, and `origin` can be the literal string "null"
		// for an opaque origin (a sandboxed iframe, a `file://` page). Both mean "no usable origin",
		// and `toSafeOrigin` turns anything that is not a clean http(s) origin into ''.
		const location = globalThis.location as Location | undefined;
		return toSafeOrigin(location?.origin);
	}
});

/** The application's origin reader. Injectable at the call site, so tests never touch this one. */
export const appOriginSeam: AppOriginSeam = createAppOriginSeam();
