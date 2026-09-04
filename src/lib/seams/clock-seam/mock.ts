// Purpose: A ClockSeam whose time only moves when a test moves it.
// Why: The behaviour worth testing around a clock is what happens at a boundary — a label that must
//      roll over at UTC midnight, a timer that must fire. Waiting for the real clock to reach one
//      is not a test. `advanceTo` moves the instant and fires everything that was due.
// Info flow: test -> createMockClockSeam().advanceTo(instant) -> due callbacks run.
import type { ClockSeam } from './contract';
import { sampleInstantMs } from './fixtures';
import { validateEpochMs } from './validators';

type ScheduledCallback = {
	dueAtMs: number;
	callback: () => void;
	/** Set the moment any path claims this entry, so no other path can run it again. */
	settled: boolean;
};

export type MockClockSeam = ClockSeam & {
	/**
	 * Move the clock to `epochMs` and run every callback that came due, in the order they fell due.
	 * Moving backwards is allowed — it sets the instant and fires nothing.
	 */
	advanceTo(epochMs: number): void;
	/**
	 * Move the clock to `epochMs` without running anything that came due. Models a browser that
	 * throttled or deferred a timer while the tab was in the background — real behaviour that any
	 * code relying on a long timer has to survive.
	 */
	setInstantWithoutFiring(epochMs: number): void;
	/** How many callbacks are still armed. Lets a test prove a timer was cancelled or rescheduled. */
	pendingCount(): number;
};

export const createMockClockSeam = (startMs: number = sampleInstantMs): MockClockSeam => {
	let currentMs = startMs;
	let scheduled: ScheduledCallback[] = [];

	// Every path that might run a callback claims it here first. `scheduleAt`'s deferred firing and
	// `advanceTo` can both be holding the same entry — a test that advances the clock before the
	// deferred turn drains would otherwise run one callback twice, which the contract forbids.
	const claim = (entry: ScheduledCallback): boolean => {
		if (entry.settled) return false;
		entry.settled = true;
		scheduled = scheduled.filter((candidate) => candidate !== entry);
		return true;
	};

	return {
		now: () => currentMs,

		scheduleAt: (epochMs, callback) => {
			validateEpochMs(epochMs);
			const entry: ScheduledCallback = { dueAtMs: epochMs, callback, settled: false };
			scheduled.push(entry);
			// An instant already at or behind the clock has to fire on its own, exactly as the
			// adapter's clamped `setTimeout` does. Queuing it until the next `advanceTo` would give
			// the mock behaviour production does not have, and a test that never advances the clock
			// would wait forever for a callback the real seam would already have run.
			//
			// `setTimeout(..., 0)` rather than `queueMicrotask`, deliberately: the adapter schedules
			// a macrotask, which runs *after* pending promise continuations. A microtask runs before
			// them, so a test that awaits a promise between scheduling and firing would observe the
			// opposite order here from the one the browser produces.
			if (epochMs <= currentMs) {
				globalThis.setTimeout(() => {
					if (claim(entry)) entry.callback();
				}, 0);
			}
			return () => {
				claim(entry);
			};
		},

		advanceTo: (epochMs) => {
			currentMs = epochMs;
			// Snapshot the due set before running anything: a callback is free to schedule its own
			// successor (a day-boundary refresh does exactly that), and the new one must not fire in
			// this same pass just because it landed in the array mid-iteration.
			const due = scheduled
				.filter((entry) => entry.dueAtMs <= epochMs)
				.sort((left, right) => left.dueAtMs - right.dueAtMs);
			for (const entry of due) {
				if (claim(entry)) entry.callback();
			}
		},

		setInstantWithoutFiring: (epochMs) => {
			currentMs = epochMs;
		},

		pendingCount: () => scheduled.length
	};
};
