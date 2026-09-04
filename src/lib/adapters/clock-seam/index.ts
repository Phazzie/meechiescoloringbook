// Purpose: Implement ClockSeam against the host clock and timer.
// Why: This is the single place in the application permitted to call `Date.now()` and
//      `setTimeout` for wall-clock purposes; everything else crosses the seam.
// Info flow: ClockSeam calls -> Date.now() / globalThis.setTimeout -> caller.
import type { ClockSeam } from '../../seams/clock-seam/contract';
import { validateEpochMs } from '../../seams/clock-seam/validators';

/**
 * The largest delay `setTimeout` accepts. Past this a host does not wait longer — it overflows the
 * signed 32-bit delay and fires almost immediately, so a timer armed for a year ahead would run
 * now. Long waits are therefore re-armed in chunks of this size until the target instant arrives.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

export const createClockSeam = (): ClockSeam => ({
	now: () => Date.now(),

	scheduleAt: (epochMs, callback) => {
		// Checked before anything is armed: `setTimeout(fn, NaN)` fires immediately, so an unchecked
		// bad instant would turn a midnight timer into an instant one — and a self-re-arming timer
		// into a spin.
		validateEpochMs(epochMs);

		let handle: ReturnType<typeof globalThis.setTimeout> | null = null;

		const arm = (): void => {
			// A boundary already past fires on the next turn rather than never: `setTimeout` treats a
			// negative delay as 0 anyway, and clamping here makes that explicit instead of incidental.
			const remainingMs = Math.max(0, epochMs - Date.now());
			if (remainingMs > MAX_TIMEOUT_MS) {
				handle = globalThis.setTimeout(arm, MAX_TIMEOUT_MS);
				return;
			}
			handle = globalThis.setTimeout(callback, remainingMs);
		};

		arm();

		return () => {
			if (handle !== null) globalThis.clearTimeout(handle);
			handle = null;
		};
	}
});

/** The application's clock. Injectable at every call site, so tests never touch this instance. */
export const clockSeam: ClockSeam = createClockSeam();
