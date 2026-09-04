// Purpose: Implement ClockSeam against the host clock and timer.
// Why: This is the single place in the application permitted to call `Date.now()` and
//      `setTimeout` for wall-clock purposes; everything else crosses the seam.
// Info flow: ClockSeam calls -> Date.now() / globalThis.setTimeout -> caller.
import type { ClockSeam } from '../../seams/clock-seam/contract';

export const createClockSeam = (): ClockSeam => ({
	now: () => Date.now(),

	scheduleAt: (epochMs, callback) => {
		// A boundary already past fires on the next turn rather than never: `setTimeout` treats a
		// negative delay as 0 anyway, and clamping here makes that explicit instead of incidental.
		const delayMs = Math.max(0, epochMs - Date.now());
		const handle = globalThis.setTimeout(callback, delayMs);
		return () => globalThis.clearTimeout(handle);
	}
});

/** The application's clock. Injectable at every call site, so tests never touch this instance. */
export const clockSeam: ClockSeam = createClockSeam();
