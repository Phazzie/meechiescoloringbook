// Purpose: Implement ClockSeam against the host clock and timer.
// Why: This is the single place in the application permitted to call `Date.now()` and
//      `setTimeout` for wall-clock purposes; everything else crosses the seam.
// Info flow: ClockSeam calls -> Date.now() / globalThis.setTimeout -> caller.
import type { ClockSeam } from '../../seams/clock-seam/contract';
import { validateEpochMs } from '../../seams/clock-seam/validators';

/**
 * The longest any single hop waits before re-reading the clock.
 *
 * This cap does two jobs at once. `setTimeout` overflows its signed 32-bit delay past roughly 24.8
 * days and fires almost immediately, so a timer armed a year out would run now; and re-checking
 * only when a timer expires misses a wall clock pushed *forward* past the target instant during an
 * ordinary wait, leaving a label stale long after the boundary passed. Waking at least this often
 * covers both: fifteen minutes bounds the staleness, and for a once-a-day boundary timer it costs
 * fewer than a hundred wakeups a day — cheap against a label that would otherwise be wrong for
 * hours.
 */
const MAX_HOP_MS = 900_000;

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
			handle = globalThis.setTimeout(fireOrRearm, Math.min(remainingMs, MAX_HOP_MS));
		};

		// The first hop always goes through a timeout, so an instant already past fires on the next
		// turn rather than synchronously inside `scheduleAt`.
		handle = globalThis.setTimeout(
			fireOrRearm,
			Math.min(Math.max(0, epochMs - Date.now()), MAX_HOP_MS)
		);

		return () => {
			if (handle !== null) globalThis.clearTimeout(handle);
			handle = null;
		};
	}
});

/** The application's clock. Injectable at every call site, so tests never touch this instance. */
export const clockSeam: ClockSeam = createClockSeam();
