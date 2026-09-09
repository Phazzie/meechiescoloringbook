/*
 * Purpose: One reactive reading of whether this device currently has a connection, for the surfaces
 *          that have to say something about a failed AI call.
 * Why: `classifyGenerationFailure` takes the connection as a value so it can stay pure, and a retry
 *      control offered to an offline reader has to re-enable itself when the connection comes back
 *      rather than when the reader next reloads. Something has to hold that fact and keep it fresh.
 * Info flow: `navigator.onLine` + the `online`/`offline` events -> ConnectionState -> the state
 *            classes' `readConnection` and `GenerationFailureNotice.svelte`.
 * Invariants:
 *   - `null` means "nothing has read it" and is a real third state, not a stand-in for `true`. On the
 *     server, in a prerendered document and in a unit test there is no `navigator` to ask, and
 *     `classifyGenerationFailure` is written to give a usable answer without one.
 *   - Deliberately NOT a seam, and this is the one judgement call in the file. `AGENTS.md` classifies
 *     browser integration as a seam boundary and `PageVisibilitySeam` was built on exactly that
 *     reasoning, so a `ConnectionSeam` is the right long-term home for this. Building one is a new
 *     contract, probe, fixtures, mock and adapter, which is a contract addition and its own pull
 *     request. Until then this follows the precedent already set by `src/routes/+layout.svelte`,
 *     which reads `navigator.onLine` directly for the offline banner, and keeps the read to a single
 *     module so there is one place for a seam to replace later rather than five.
 */

/**
 * `navigator.onLine`, or `null` where there is no navigator to ask.
 *
 * The `typeof` check on the property as well as the object is deliberate: some embedded and test
 * environments provide a `navigator` without `onLine`, and `undefined` read as a boolean would be
 * `false` — reporting a reader as offline on a working connection, which is the most damaging thing
 * this module could get wrong.
 */
export const readIsOnline = (): boolean | null =>
	typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'
		? null
		: navigator.onLine;

/**
 * The tab's connection state, shared.
 *
 * One per tab rather than one per component: `navigator.onLine` is a property of the device, so a
 * second instance would hold the same value and arm a second pair of listeners for it.
 */
class ConnectionState {
	#isOnline = $state<boolean | null>(readIsOnline());

	get isOnline(): boolean | null {
		return this.#isOnline;
	}

	/**
	 * Track the connection until the returned function is called.
	 *
	 * Re-reads on subscribe as well as on each event, because a component mounting after the browser
	 * has already gone offline would otherwise hold whatever the value was when this module first
	 * loaded. Callers may overlap freely; the extra listeners cost one property read each.
	 */
	listen(): () => void {
		if (typeof globalThis.addEventListener !== 'function') return () => {};
		const sync = (): void => {
			this.#isOnline = readIsOnline();
		};
		sync();
		globalThis.addEventListener('online', sync);
		globalThis.addEventListener('offline', sync);
		return () => {
			globalThis.removeEventListener('online', sync);
			globalThis.removeEventListener('offline', sync);
		};
	}
}

export const connection = new ConnectionState();
