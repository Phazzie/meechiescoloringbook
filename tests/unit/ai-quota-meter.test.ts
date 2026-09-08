// Purpose: Unit tests for `AiQuotaMeter`, the one holder of every quota reading a surface receives.
// Why: The defect this class was written to end is not "no meter" — it is a meter narrating the
//      WRONG bucket. The server meters `text` (20 units a minute: verdicts, rewrites, read-backs)
//      and `image` (8 a minute: every coloring page, wig try-on and picture) on independent
//      windows, and the app read only `text` while showing it above buttons that spend `image`.
//      So the cases that matter here are the ones about separation: a reading landing in its own
//      slot, one bucket's sentence never being derived from the other's number, and the two windows
//      expiring without touching each other.
// Info flow: fake Headers + a driven ClockSeam -> AiQuotaMeter.record -> slot + sentence assertions.
import { describe, expect, it } from 'vitest';
import { AiQuotaMeter } from '../../src/lib/components/ai-quota-meter.svelte';
import type { ClockSeam } from '../../src/lib/seams/clock-seam/contract';

const NOW = 1_700_000_000_000;

/** Fixed formatter, so an assertion is about the sentence and not the runner's locale. */
const atClock = (date: Date): string => `T+${(date.getTime() - NOW) / 1_000}s`;

/** The header shape the rate-limit guard actually emits, so a test cannot drift from the server. */
const quotaHeaders = (
	limit: number,
	remaining: number,
	resetSeconds: number
): Headers =>
	new Headers({
		'RateLimit-Limit': String(limit),
		'RateLimit-Remaining': String(remaining),
		'RateLimit-Reset': String(resetSeconds)
	});

/**
 * A clock whose scheduled callbacks fire only when the test says so.
 *
 * Records the instant each timer was set for, so a case can assert that the two buckets scheduled
 * two independent expiries rather than sharing one.
 */
const drivenClock = (): ClockSeam & {
	fireAll: () => void;
	scheduledAt: number[];
	cancelled: number;
} => {
	const pending: { at: number; run: () => void }[] = [];
	let cancelled = 0;
	return {
		now: () => NOW,
		scheduleAt(at: number, run: () => void) {
			const entry = { at, run };
			pending.push(entry);
			return () => {
				cancelled += 1;
				const index = pending.indexOf(entry);
				if (index >= 0) pending.splice(index, 1);
			};
		},
		get scheduledAt() {
			return pending.map((entry) => entry.at);
		},
		get cancelled() {
			return cancelled;
		},
		fireAll() {
			const due = pending.splice(0, pending.length);
			for (const entry of due) entry.run();
		}
	} as ClockSeam & {
		fireAll: () => void;
		scheduledAt: number[];
		cancelled: number;
	};
};

const meterWith = (
	clock: ClockSeam
): AiQuotaMeter => new AiQuotaMeter({ clock: () => clock, formatTime: atClock });

describe('AiQuotaMeter bucket separation', () => {
	it('files a reading under the bucket it was recorded for, leaving the other empty', () => {
		const meter = meterWith(drivenClock());

		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');

		expect(meter.image).toEqual({
			bucket: 'image',
			limit: 8,
			remaining: 5,
			resetAtMs: NOW + 30_000,
			exhausted: false
		});
		// The whole point. An image reading must not become the text bucket's number.
		expect(meter.text).toBeNull();
		expect(meter.textMessage()).toBe('');
	});

	// This is the defect, stated directly: the home studio showed a text-bucket sentence above a
	// button that spends the image bucket. With separate slots the image sentence stays silent
	// until the image bucket has actually reported, however much the text bucket knows.
	it('never lets one bucket answer for the other', () => {
		const meter = meterWith(drivenClock());

		meter.record(quotaHeaders(20, 20, 60), NOW, 'text');

		expect(meter.textMessage()).toBe('10 AI calls left before T+60s.');
		// Ten text calls in hand says nothing whatsoever about pages.
		expect(meter.pictureMessage()).toBe('');
		expect(meter.pictureExhausted()).toBe(false);
	});

	it('holds both buckets at once for a surface that spends both', () => {
		const meter = meterWith(drivenClock());

		meter.record(quotaHeaders(20, 14, 45), NOW, 'text');
		meter.record(quotaHeaders(8, 3, 20), NOW, 'image');

		expect(meter.textMessage()).toBe('7 AI calls left before T+45s.');
		expect(meter.pictureMessage()).toBe('3 pages left before T+20s.');
	});
});

describe('AiQuotaMeter picture pricing', () => {
	// `runGeneratePipeline` charges `imageRequest.variations`, so a four-picture page costs four of
	// the eight units. Pricing a page at a flat 1 would promise three more pages than exist.
	it('prices a page at the number of pictures that page asks for', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 6, 30), NOW, 'image');

		expect(meter.pictureMessage(1)).toBe('6 pages left before T+30s.');
		expect(meter.pictureMessage(2)).toBe('3 pages left before T+30s.');
		expect(meter.pictureMessage(4)).toBe('1 page left before T+30s.');
	});

	// Six units cannot fund a page costing eight, and saying "0 pages" is the honest reading.
	it('reports the desk full when the units cannot pay for one whole page', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 3, 30), NOW, 'image');

		expect(meter.pictureMessage(4)).toBe(
			"Meechie's desk is full. Ready again at T+30s."
		);
		expect(meter.pictureExhausted(4)).toBe(true);
		// The same reading, for the page the reader could actually afford.
		expect(meter.pictureExhausted(1)).toBe(false);
	});
});

describe('AiQuotaMeter expiry', () => {
	// The buckets refill on independent windows, so one expiring must not clear the other. A single
	// shared cancellation handle — which is what both copies of this code used to have — would.
	it('expires each bucket on its own timer', () => {
		const clock = drivenClock();
		const meter = meterWith(clock);

		meter.record(quotaHeaders(20, 14, 45), NOW, 'text');
		meter.record(quotaHeaders(8, 5, 20), NOW, 'image');

		// Two readings, two timers, at two different instants.
		expect(clock.scheduledAt).toEqual([NOW + 45_000, NOW + 20_000]);
		expect(clock.cancelled).toBe(0);
	});

	it('clears a reading when its own window closes', () => {
		const clock = drivenClock();
		const meter = meterWith(clock);
		meter.record(quotaHeaders(8, 0, 20), NOW, 'image');

		expect(meter.pictureExhausted()).toBe(true);

		clock.fireAll();

		// Un-latches on its own: a reader told the desk is full who waits must not still be told so
		// after the bucket refilled.
		expect(meter.image).toBeNull();
		expect(meter.pictureMessage()).toBe('');
		expect(meter.pictureExhausted()).toBe(false);
	});

	it('replaces a bucket reading rather than stacking a second timer for it', () => {
		const clock = drivenClock();
		const meter = meterWith(clock);

		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');
		meter.record(quotaHeaders(8, 4, 25), NOW, 'image');

		expect(meter.image?.remaining).toBe(4);
		expect(clock.cancelled).toBe(1);
		expect(clock.scheduledAt).toEqual([NOW + 25_000]);
	});
});

describe('AiQuotaMeter silence', () => {
	// `null` means "not known" and must never gate a control: a surface refuses a click only on a
	// server statement it currently holds, never on a guess.
	it('says nothing and blocks nothing before the server has reported', () => {
		const meter = meterWith(drivenClock());

		expect(meter.textMessage()).toBe('');
		expect(meter.pictureMessage()).toBe('');
		expect(meter.textExhausted()).toBe(false);
		expect(meter.pictureExhausted()).toBe(false);
	});

	// A response missing the headers leaves the previous reading alone rather than blanking the
	// meter on one odd reply.
	it('keeps the last good reading when a response carries no usable headers', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');

		meter.record(new Headers({ 'Content-Type': 'application/json' }), NOW, 'image');

		expect(meter.image?.remaining).toBe(5);
	});

	it('releases every pending timer on dispose', () => {
		const clock = drivenClock();
		const meter = meterWith(clock);
		meter.record(quotaHeaders(20, 14, 45), NOW, 'text');
		meter.record(quotaHeaders(8, 5, 20), NOW, 'image');

		meter.dispose();

		expect(clock.cancelled).toBe(2);
		expect(clock.scheduledAt).toEqual([]);
	});
});
