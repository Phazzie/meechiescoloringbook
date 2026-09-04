// Purpose: A ClockSeam whose time only moves when a test moves it.
// Why: The behaviour worth testing around a clock is what happens at a boundary — a label that must
//      roll over at UTC midnight, a timer that must fire. Waiting for the real clock to reach one
//      is not a test. `advanceTo` moves the instant and fires everything that was due.
// Info flow: test -> createMockClockSeam().advanceTo(instant) -> due callbacks run.
import type { ClockSeam } from './contract';
import { sampleInstantMs } from './fixtures';

type ScheduledCallback = { dueAtMs: number; callback: () => void; cancelled: boolean };

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

	return {
		now: () => currentMs,

		scheduleAt: (epochMs, callback) => {
			const entry: ScheduledCallback = { dueAtMs: epochMs, callback, cancelled: false };
			scheduled.push(entry);
			return () => {
				entry.cancelled = true;
				scheduled = scheduled.filter((candidate) => candidate !== entry);
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
			scheduled = scheduled.filter((entry) => entry.dueAtMs > epochMs);
			for (const entry of due) {
				if (!entry.cancelled) entry.callback();
			}
		},

		setInstantWithoutFiring: (epochMs) => {
			currentMs = epochMs;
		},

		pendingCount: () => scheduled.length
	};
};
