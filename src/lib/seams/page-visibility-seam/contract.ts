// Purpose: Define the PageVisibilitySeam contract — is the page being looked at, and tell me when
//          it comes back.
// Why: `AGENTS.md` classifies OS/browser integration as a seam. Reading `document.visibilityState`
//      and subscribing to `visibilitychange` directly would put the "tab came back" path outside
//      any boundary, where a test can only reach it by dispatching a real DOM event.
// Info flow: caller -> PageVisibilitySeam -> real `document` (adapter) or a driveable fake (mock).

/**
 * Neither operation can fail. Where there is no document — a server render, a unit test — the page
 * is reported as visible and nothing is ever announced, which is the behaviour callers already
 * need. Synchronous and without `Result<>` for the same reason as `ClockSeam`.
 */
export type PageVisibilitySeam = {
	/** Whether the page is currently being displayed. True where there is no document to ask. */
	isVisible(): boolean;
	/**
	 * Call `callback` each time the page becomes visible again after being hidden. Returns an
	 * unsubscribe function; calling it twice, or after teardown, is a no-op.
	 */
	onVisible(callback: () => void): () => void;
};
