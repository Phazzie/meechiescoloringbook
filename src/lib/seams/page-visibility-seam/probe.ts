// Purpose: Observe what the real host reports for page visibility, and whether it announces
//          transitions.
// Why: A probe exists to check external behaviour rather than assert an expectation. Visibility is
//      the seam most likely to differ between hosts — Node has no `document`, embedded webviews
//      have historically reported states outside the spec, and some hosts never fire the event at
//      all. It is runnable code, not a note.
// Info flow: probePageVisibilitySeam() -> real adapter -> observations -> caller/console.
//
// Run it in Node: `npm run probe -- page-visibility-seam` — expect
// `hostReported: null`, `seamReported: true`, `subscribeWasNoOp: true`.
// Run it in a browser: call it from DevTools, then switch tabs and come back; `announcedReturn`
// flips to true when the host really does announce the transition.
import { createPageVisibilitySeam } from '../../adapters/page-visibility-seam';

export type PageVisibilityProbeReport = {
	/** Exactly what the host reported, or null where there is no document. */
	hostReported: string | null;
	/** What the seam resolved that to. */
	seamReported: boolean;
	/** Whether subscribing did nothing because there is no document to subscribe to. */
	subscribeWasNoOp: boolean;
	/** Set to true once the host announces a return to visibility. Watch it in a browser. */
	announcedReturn: () => boolean;
	/** Detach the probe's subscriber. */
	stop: () => void;
};

export const probePageVisibilitySeam = (): PageVisibilityProbeReport => {
	const host = typeof document === 'undefined' ? undefined : document;
	const seam = createPageVisibilitySeam();

	let announced = false;
	const stop = seam.onVisible(() => {
		announced = true;
	});

	return {
		hostReported: host?.visibilityState ?? null,
		seamReported: seam.isVisible(),
		subscribeWasNoOp: host === undefined,
		announcedReturn: () => announced,
		stop
	};
};

/** What the Node runner prints: plain data, with the subscription already torn down. */
export type PageVisibilityProbeSnapshot = Omit<
	PageVisibilityProbeReport,
	'announcedReturn' | 'stop'
> & { announcedReturn: boolean };

/**
 * Uniform entry point `npm run probe -- page-visibility-seam` calls.
 *
 * What it returns depends on whether there is a host to observe, because the two callers need
 * different things. Under Node there is no `document`, nothing can ever announce a return, and the
 * runner wants JSON — so the subscription is torn down and a flat snapshot comes back.
 *
 * In a browser the whole point is the transition, and a snapshot cannot carry one: reading
 * `announcedReturn` at the moment of the call always yields false, and unsubscribing straight
 * afterwards guarantees it stays that way. So the live report is returned instead, still
 * subscribed. Call `runProbe()`, switch tabs, come back, then read `announcedReturn()` — and call
 * `stop()` when finished.
 */
export const runProbe = (): PageVisibilityProbeReport | PageVisibilityProbeSnapshot => {
	const report = probePageVisibilitySeam();
	if (!report.subscribeWasNoOp) return report;
	const snapshot: PageVisibilityProbeSnapshot = {
		hostReported: report.hostReported,
		seamReported: report.seamReported,
		subscribeWasNoOp: report.subscribeWasNoOp,
		announcedReturn: report.announcedReturn()
	};
	report.stop();
	return snapshot;
};
