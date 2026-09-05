// Purpose: Observe what the real host reports as the application origin.
// Why: A probe exists to check external behaviour rather than assert an expectation. Here that is
//      `globalThis.location.origin`, which differs meaningfully between a Node run (absent), a
//      normal page (an http(s) origin), a sandboxed iframe or `file://` page (the literal string
//      "null"), and anything a future host invents. It is runnable code, not a note.
// Info flow: probeAppOriginSeam() -> real adapter -> observations -> caller/console.
//
// Run it in Node: `npm run probe -- app-origin-seam` — expect `hostReported: null`
// and `seamReported: ''`, which is the server-render case.
// Run it in a browser: paste the two calls into DevTools on a served page and compare.
import { createAppOriginSeam } from '../../adapters/app-origin-seam';

export type AppOriginProbeReport = {
	/** Exactly what the host handed back, before the seam looked at it. */
	hostReported: string | null;
	/** What the seam reports after validation. */
	seamReported: string;
	/** Whether the seam passed the host value through unchanged. */
	acceptedHostValue: boolean;
	/** Whether the seam degraded a value the host gave but the validator refused. */
	degradedHostValue: boolean;
};

export const probeAppOriginSeam = (): AppOriginProbeReport => {
	const host = globalThis.location as Location | undefined;
	const hostReported = host?.origin ?? null;
	const seamReported = createAppOriginSeam().getOrigin();

	return {
		hostReported,
		seamReported,
		acceptedHostValue: hostReported !== null && seamReported === hostReported,
		degradedHostValue:
			hostReported !== null && hostReported.length > 0 && seamReported === ''
	};
};

/** Uniform entry point `npm run probe -- app-origin-seam` calls. Also safe from a browser. */
export const runProbe = probeAppOriginSeam;
