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

	// The second request is anchored five seconds later with five fewer seconds to reset, which is
	// what a real pair from one window looks like: `RateLimit-Reset` counts down as the request
	// instant advances, so both readings land on the SAME absolute reset instant. (An earlier draft
	// of this case anchored both at `NOW` with resets of 30 then 25, which would mean the window's
	// end moved backwards — impossible, and it read as a stale reading once ordering was added.)
	it('replaces a bucket reading rather than stacking a second timer for it', () => {
		const clock = drivenClock();
		const meter = meterWith(clock);

		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');
		meter.record(quotaHeaders(8, 4, 25), NOW + 5_000, 'image');

		expect(meter.image?.remaining).toBe(4);
		expect(clock.cancelled).toBe(1);
		expect(clock.scheduledAt).toEqual([NOW + 30_000]);
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

// Responses do not arrive in the order the server charged them. On the home studio a coloring page
// and a wig try-on both spend `image` behind separate `isGenerating` / `isTryingOn` guards, so a
// generation that charged FIRST routinely returns AFTER a try-on that charged second. Taking
// whichever landed last would put the older, higher `remaining` back on screen.
describe('AiQuotaMeter reading order', () => {
	it('keeps the newer reading when an older response lands last', () => {
		const meter = meterWith(drivenClock());

		// The try-on charged second and answered first: 3 left.
		meter.record(quotaHeaders(8, 3, 30), NOW, 'image');
		// The page charged first and answered late, still believing 5 were left.
		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');

		expect(meter.image?.remaining).toBe(3);
		expect(meter.pictureMessage()).toBe('3 pages left before T+30s.');
	});

	it('still accepts a lower reading that arrives in order', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');
		meter.record(quotaHeaders(8, 3, 30), NOW, 'image');

		expect(meter.image?.remaining).toBe(3);
	});

	// A refill is the one case where a HIGHER remaining is the newer truth, and the later window is
	// what says so. Without this rule the meter would latch at its low-water mark forever.
	it('takes a higher reading when the window has moved on', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 0, 10), NOW, 'image');
		// A later reset instant: the bucket refilled.
		meter.record(quotaHeaders(8, 8, 60), NOW + 20_000, 'image');

		expect(meter.image?.remaining).toBe(8);
		expect(meter.pictureExhausted()).toBe(false);
	});

	it('discards a reading from a window that has already closed', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 8, 60), NOW + 20_000, 'image');
		// An older window's straggler, with a healthier-looking count.
		meter.record(quotaHeaders(8, 2, 10), NOW, 'image');

		expect(meter.image?.remaining).toBe(8);
	});

	// Ordering is per bucket: a text reading must never be weighed against an image one.
	it('orders each bucket independently', () => {
		const meter = meterWith(drivenClock());
		meter.record(quotaHeaders(8, 2, 30), NOW, 'image');
		meter.record(quotaHeaders(20, 18, 30), NOW, 'text');

		expect(meter.image?.remaining).toBe(2);
		expect(meter.text?.remaining).toBe(18);
	});

	it('does not arm an expiry timer for a reading it discarded', () => {
		const clock = drivenClock();
		const meter = meterWith(clock);
		meter.record(quotaHeaders(8, 3, 30), NOW, 'image');
		meter.record(quotaHeaders(8, 5, 30), NOW, 'image');

		// One reading accepted, so one timer — not two, and nothing cancelled.
		expect(clock.scheduledAt).toEqual([NOW + 30_000]);
		expect(clock.cancelled).toBe(0);
	});
});
