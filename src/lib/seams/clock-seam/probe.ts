// Purpose: Observe the real host clock and timer, and report what they actually did.
// Why: A probe exists to check external behaviour rather than assert an expectation. For this seam
//      the "external world" is `Date.now()` and `setTimeout` — no credentials, no network — so the
//      probe runs anywhere and needs no fixture refresh. It is runnable code, not a note: run it
//      when porting to a new host, or when a timer behaves oddly in a real browser.
// Info flow: probeClockSeam() -> real adapter -> observations -> caller/console.
//
// Run it: `npx tsx src/lib/seams/clock-seam/probe.ts`
import { createClockSeam } from '../../adapters/clock-seam';
import { DAY_MS } from './contract';

export type ClockProbeReport = {
	/** Whether `now()` sat between two `Date.now()` readings taken around it. */
	tracksHostClock: boolean;
	/** Milliseconds actually elapsed before a callback armed for +50ms ran. */
	nearFutureDelayMs: number;
	/** Whether an instant already a day past ran rather than never. */
	pastInstantRan: boolean;
	/** Whether cancelling before the instant arrived stopped the callback. */
	cancelPrevented: boolean;
	/** Whether an instant beyond the 32-bit timeout limit stayed pending instead of firing early. */
	beyondTimeoutLimitStayedPending: boolean;
};

const waitMs = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const probeClockSeam = async (): Promise<ClockProbeReport> => {
	const clock = createClockSeam();

	const before = Date.now();
	const reading = clock.now();
	const after = Date.now();

	let nearFutureAt = 0;
	const armedAt = Date.now();
	clock.scheduleAt(armedAt + 50, () => {
		nearFutureAt = Date.now();
	});

	let pastInstantRan = false;
	clock.scheduleAt(Date.now() - DAY_MS, () => {
		pastInstantRan = true;
	});

	let cancelledRan = false;
	const cancel = clock.scheduleAt(Date.now() + 30, () => {
		cancelledRan = true;
	});
	cancel();

	// A year ahead is far beyond `setTimeout`'s 32-bit limit. An unchunked implementation fires
	// this almost immediately; a chunked one leaves it pending.
	let farFutureRan = false;
	const cancelFarFuture = clock.scheduleAt(Date.now() + 365 * DAY_MS, () => {
		farFutureRan = true;
	});

	await waitMs(200);
	cancelFarFuture();

	return {
		tracksHostClock: before <= reading && reading <= after,
		nearFutureDelayMs: nearFutureAt === 0 ? -1 : nearFutureAt - armedAt,
		pastInstantRan,
		cancelPrevented: !cancelledRan,
		beyondTimeoutLimitStayedPending: !farFutureRan
	};
};

if (process.argv[1]?.endsWith('probe.ts')) {
	process.stdout.write(`${JSON.stringify(await probeClockSeam(), null, 2)}\n`);
}
