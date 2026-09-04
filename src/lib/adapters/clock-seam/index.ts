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

		// Every expiry re-reads the wall clock and decides again, rather than trusting the delay
		// computed when the timer was armed. A `setTimeout` measures elapsed time, not an instant,
		// so a system clock adjustment desynchronises the two: set the clock back and a timer armed
		// for midnight fires early, set it forward and midnight passes with the labels still stale.
		// Re-deciding also gives the chunking for free — a delay past the host's 32-bit limit simply
		// becomes another round.
		const fireOrRearm = (): void => {
			const remainingMs = epochMs - Date.now();
			if (remainingMs <= 0) {
				callback();
				return;
			}
			handle = globalThis.setTimeout(fireOrRearm, Math.min(remainingMs, MAX_TIMEOUT_MS));
		};

		// The first hop always goes through a timeout, so an instant already past fires on the next
		// turn rather than synchronously inside `scheduleAt`.
		handle = globalThis.setTimeout(
			fireOrRearm,
			Math.min(Math.max(0, epochMs - Date.now()), MAX_TIMEOUT_MS)
		);

		return () => {
			if (handle !== null) globalThis.clearTimeout(handle);
			handle = null;
		};
	}
});

/** The application's clock. Injectable at every call site, so tests never touch this instance. */
export const clockSeam: ClockSeam = createClockSeam();
