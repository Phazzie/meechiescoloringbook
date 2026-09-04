// Purpose: Contract tests for ClockSeam — the mock's behaviour and the adapter's fidelity.
// Why: Prove the mock is a faithful stand-in (so tests written against it mean something) and that
//      the adapter really does track the host clock and timer.
// Info flow: tests -> mock / adapter -> contract assertions.
import { describe, expect, it, vi } from 'vitest';
import { createClockSeam } from '../../adapters/clock-seam';
import { DAY_MS, nextUtcDayBoundary } from './contract';
import { lateInstantMs, nextDayBoundaryMs, sampleInstantMs } from './fixtures';
import { createMockClockSeam } from './mock';

describe('nextUtcDayBoundary', () => {
	it('returns the first instant of the following UTC day', () => {
		expect(nextUtcDayBoundary(lateInstantMs)).toBe(nextDayBoundaryMs);
	});

	it('returns the next boundary, not the current one, when given a boundary exactly', () => {
		expect(nextUtcDayBoundary(nextDayBoundaryMs)).toBe(nextDayBoundaryMs + DAY_MS);
	});

	it('is always strictly in the future of the instant it is given', () => {
		for (const instant of [0, sampleInstantMs, lateInstantMs, nextDayBoundaryMs]) {
			expect(nextUtcDayBoundary(instant)).toBeGreaterThan(instant);
		}
	});
});

describe('ClockSeam mock contract', () => {
	it('reports the instant it was started at and does not move on its own', () => {
		const clock = createMockClockSeam(sampleInstantMs);

		expect(clock.now()).toBe(sampleInstantMs);
		expect(clock.now()).toBe(sampleInstantMs);
	});

	it('runs a callback once the clock reaches its instant', () => {
		const clock = createMockClockSeam(lateInstantMs);
		const ran = vi.fn();
		clock.scheduleAt(nextDayBoundaryMs, ran);

		expect(ran).not.toHaveBeenCalled();

		clock.advanceTo(nextDayBoundaryMs);

		expect(ran).toHaveBeenCalledTimes(1);
		expect(clock.now()).toBe(nextDayBoundaryMs);
	});

	it('leaves a callback armed when the clock stops short of its instant', () => {
		const clock = createMockClockSeam(sampleInstantMs);
		const ran = vi.fn();
		clock.scheduleAt(nextDayBoundaryMs, ran);

		clock.advanceTo(lateInstantMs);

		expect(ran).not.toHaveBeenCalled();
		expect(clock.pendingCount()).toBe(1);
	});

	it('does not run a cancelled callback', () => {
		const clock = createMockClockSeam(lateInstantMs);
		const ran = vi.fn();
		const cancel = clock.scheduleAt(nextDayBoundaryMs, ran);

		cancel();
		clock.advanceTo(nextDayBoundaryMs);

		expect(ran).not.toHaveBeenCalled();
		expect(clock.pendingCount()).toBe(0);
	});

	it('tolerates cancelling twice, and cancelling after the callback has run', () => {
		const clock = createMockClockSeam(lateInstantMs);
		const cancel = clock.scheduleAt(nextDayBoundaryMs, vi.fn());

		clock.advanceTo(nextDayBoundaryMs);

		expect(() => {
			cancel();
			cancel();
		}).not.toThrow();
	});

	it('runs due callbacks in the order they fell due', () => {
		const clock = createMockClockSeam(sampleInstantMs);
		const order: string[] = [];
		clock.scheduleAt(nextDayBoundaryMs + DAY_MS, () => order.push('second'));
		clock.scheduleAt(nextDayBoundaryMs, () => order.push('first'));

		clock.advanceTo(nextDayBoundaryMs + DAY_MS);

		expect(order).toEqual(['first', 'second']);
	});

	// A rolling refresh reschedules itself from inside its own callback. If the mock fired that
	// successor in the same pass it would loop forever, so this is the property that keeps the
	// day-boundary pattern usable.
	it('does not run a callback scheduled from inside a callback in the same pass', () => {
		const clock = createMockClockSeam(lateInstantMs);
		const runs: number[] = [];
		const scheduleNext = (): void => {
			clock.scheduleAt(nextUtcDayBoundary(clock.now()), () => {
				runs.push(clock.now());
				scheduleNext();
			});
		};
		scheduleNext();

		clock.advanceTo(nextDayBoundaryMs);

		expect(runs).toEqual([nextDayBoundaryMs]);
		expect(clock.pendingCount()).toBe(1);
	});

	it('moves the instant without firing when a background tab throttles the timer', () => {
		const clock = createMockClockSeam(lateInstantMs);
		const ran = vi.fn();
		clock.scheduleAt(nextDayBoundaryMs, ran);

		clock.setInstantWithoutFiring(nextDayBoundaryMs + DAY_MS);

		expect(clock.now()).toBe(nextDayBoundaryMs + DAY_MS);
		expect(ran).not.toHaveBeenCalled();
		expect(clock.pendingCount()).toBe(1);
	});

	it('sets the instant and fires nothing when moved backwards', () => {
		const clock = createMockClockSeam(nextDayBoundaryMs);
		const ran = vi.fn();
		clock.scheduleAt(nextDayBoundaryMs + DAY_MS, ran);

		clock.advanceTo(sampleInstantMs);

		expect(clock.now()).toBe(sampleInstantMs);
		expect(ran).not.toHaveBeenCalled();
	});
});

// The mock is only worth anything if the adapter it stands in for behaves the same way. This is
// the probe described in `probe.ts`: the real host clock and timer, asserted locally.
describe('ClockSeam adapter against the real host clock', () => {
	it('reports an instant that tracks the host clock', () => {
		const clock = createClockSeam();

		const before = clock.now();
		const hostReading = Date.now();
		const after = clock.now();

		expect(before).toBeLessThanOrEqual(hostReading);
		expect(hostReading).toBeLessThanOrEqual(after);
	});

	it('runs a callback when a near-future instant arrives', async () => {
		const clock = createClockSeam();
		const ran = vi.fn();

		clock.scheduleAt(Date.now() + 5, ran);
		await new Promise((resolve) => setTimeout(resolve, 40));

		expect(ran).toHaveBeenCalledTimes(1);
	});

	it('runs a callback for an instant already past rather than never', async () => {
		const clock = createClockSeam();
		const ran = vi.fn();

		clock.scheduleAt(Date.now() - DAY_MS, ran);
		await new Promise((resolve) => setTimeout(resolve, 40));

		expect(ran).toHaveBeenCalledTimes(1);
	});

	it('does not run a cancelled callback', async () => {
		const clock = createClockSeam();
		const ran = vi.fn();

		const cancel = clock.scheduleAt(Date.now() + 5, ran);
		cancel();
		await new Promise((resolve) => setTimeout(resolve, 40));

		expect(ran).not.toHaveBeenCalled();
	});
});
