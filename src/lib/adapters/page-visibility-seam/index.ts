// Purpose: Implement PageVisibilitySeam against the browser Page Visibility API.
// Why: This is the single place in the application permitted to read `document.visibilityState`
//      or subscribe to `visibilitychange`.
// Info flow: PageVisibilitySeam calls -> document.visibilityState / visibilitychange -> caller.
import type { PageVisibilitySeam } from '../../seams/page-visibility-seam/contract';
import { isVisibleState } from '../../seams/page-visibility-seam/validators';

const getDocument = (): Document | undefined =>
	typeof document === 'undefined' ? undefined : document;

export const createPageVisibilitySeam = (): PageVisibilitySeam => ({
	// No document during a server render, and a host may report a state outside the spec.
	// `isVisibleState` resolves both to "visible", which costs at most a refresh nobody needed.
	isVisible: () => isVisibleState(getDocument()?.visibilityState),

	onVisible: (callback) => {
		const host = getDocument();
		if (!host) return () => {};
		const listener = (): void => {
			if (isVisibleState(host.visibilityState)) callback();
		};
		host.addEventListener('visibilitychange', listener);
		return () => host.removeEventListener('visibilitychange', listener);
	}
});

/** The application's visibility source. Injectable at the call site, so tests never touch this. */
export const pageVisibilitySeam: PageVisibilitySeam = createPageVisibilitySeam();
