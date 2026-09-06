/*
 * Purpose: Prove the home page's mode spotlight is a pure, UTC, testable function of an instant.
 * Why: The rotation this replaces had no unit test at all. The only test that named it lived in
 *      `tests/e2e/smoke.spec.ts` and called the very function under test to work out what to
 *      expect, so it could not disagree with the page no matter what either of them did — and
 *      nothing could stage the two instants that actually mattered, a week rollover and the first
 *      of a month, because both were read from the host clock inside core logic.
 * Info flow: an explicit epoch instant -> getModeSpotlight / describeSpotlightSchedule -> assertion.
 * Invariants: every instant in this file is written as an explicit `Date.UTC(...)`. Nothing here
 *             may call `Date.now()` or `new Date()` with no argument: a test that reads the host
 *             clock is the defect being fixed, not the fix.
 */
import { describe, expect, it } from 'vitest';
import {
	describeSpotlightSchedule,
	getModeSpotlight,
	getMonthlyMode,
	getWeeklyModes,
	studioModes,
	utcMonthIndex,
	utcWeekIndex
} from '../../src/lib/core/meechie-studio';

/** 2026-09-06 is a Sunday — the day the spotlight was measured and this run began. */
const SUN_2026_09_06 = Date.UTC(2026, 8, 6, 12, 0, 0);

describe('the spotlight is a pure function of a UTC instant', () => {
	it('answers the same for one instant however it is reached', () => {
		expect(getModeSpotlight(SUN_2026_09_06)).toEqual(getModeSpotlight(SUN_2026_09_06));
	});

	it('never puts one mode in both the month and the week', () => {
		// The whole reason `getModeSpotlight` returns one value rather than three accessors. Walked
		// across two full years of Mondays so every (month, week) pairing is exercised.
		for (
			let at = Date.UTC(2026, 0, 5);
			at < Date.UTC(2028, 0, 5);
			at += 7 * 86_400_000
		) {
			const spotlight = getModeSpotlight(at);
			expect(spotlight.weeklyIds, new Date(at).toISOString()).not.toContain(
				spotlight.monthlyId
			);
			expect(new Set(spotlight.weeklyIds).size).toBe(2);
		}
	});

	it('spotlights three of the eight and leaves the other five on the strip', () => {
		const spotlight = getModeSpotlight(SUN_2026_09_06);
		const lit = new Set([spotlight.monthlyId, ...spotlight.weeklyIds]);
		expect(lit.size).toBe(3);
		// The assertion the old rotation could not make, because the five were not rendered at all.
		expect(studioModes).toHaveLength(8);
		expect(studioModes.filter((mode) => !lit.has(mode.id))).toHaveLength(5);
	});

	it('names every mode as the month’s over eight consecutive months', () => {
		const named = new Set<string>();
		for (let month = 0; month < 8; month += 1) {
			named.add(getMonthlyMode(Date.UTC(2026, month, 15)).id);
		}
		expect(named.size).toBe(studioModes.length);
	});
});

describe('the calendar boundaries are the ones the strip claims', () => {
	it('rolls the week over on Monday 00:00 UTC, not the epoch Thursday', () => {
		// The replaced code was `Math.floor(Date.now() / (7 * day))`. 1970-01-01 was a Thursday, so
		// that rolled over on Thursdays — a boundary no comment in it mentioned and no reader could
		// have guessed from a strip that said nothing about itself.
		const sunday = Date.UTC(2026, 8, 6, 23, 59, 59, 999);
		const monday = Date.UTC(2026, 8, 7, 0, 0, 0);
		expect(utcWeekIndex(sunday)).toBe(utcWeekIndex(Date.UTC(2026, 8, 1)));
		expect(utcWeekIndex(monday)).toBe(utcWeekIndex(sunday) + 1);

		// And the Thursday inside that week is not a boundary any more.
		const thursday = Date.UTC(2026, 8, 3, 0, 0, 0);
		expect(utcWeekIndex(thursday)).toBe(utcWeekIndex(Date.UTC(2026, 8, 2)));
	});

	it('indexes the month in UTC, so a build machine and a reader west of it agree', () => {
		// 2026-09-01 00:30 UTC is 2026-08-31 17:30 in UTC-7. The replaced `getMonthKey` used
		// `new Date().getMonth()` — local — while the week came off the UTC epoch, so the
		// prerendered document (built in UTC) and the browser disagreed about which mode was the
		// month's for those hours, and the strip changed under the reader on hydration.
		const firstOfSeptemberUtc = Date.UTC(2026, 8, 1, 0, 30, 0);
		expect(utcMonthIndex(firstOfSeptemberUtc)).toBe(2026 * 12 + 8);
		expect(utcMonthIndex(Date.UTC(2026, 7, 31, 23, 59, 59))).toBe(2026 * 12 + 7);
		expect(getMonthlyMode(firstOfSeptemberUtc).id).not.toBe(
			getMonthlyMode(Date.UTC(2026, 7, 31, 23, 59, 59)).id
		);
	});

	it('changes at the next Monday when that comes before the next first-of-month', () => {
		const spotlight = getModeSpotlight(SUN_2026_09_06);
		expect(spotlight.changesAtMs).toBe(Date.UTC(2026, 8, 7));
	});

	it('changes at the first of the month when that comes before the next Monday', () => {
		// 2026-09-28 is a Monday, so the next Monday is 2026-10-05 — but October starts first.
		const spotlight = getModeSpotlight(Date.UTC(2026, 8, 29, 9, 0, 0));
		expect(spotlight.changesAtMs).toBe(Date.UTC(2026, 9, 1));
	});

	it('is always strictly ahead of the instant it was asked about', () => {
		// A caller re-arming a timer on `changesAtMs` spins forever if a boundary instant reports
		// itself. Both boundaries are checked exactly on the boundary for that reason.
		for (const at of [
			Date.UTC(2026, 8, 7), // a Monday, 00:00 UTC
			Date.UTC(2026, 9, 1), // a first-of-month, 00:00 UTC
			Date.UTC(2026, 5, 1) // a first-of-month that is also a Monday
		]) {
			expect(getModeSpotlight(at).changesAtMs).toBeGreaterThan(at);
		}
	});

	it('is a boundary the studio already wakes up on', () => {
		// `StudioState` derives the spotlight from `nowMs`, which `startSavedLabelRefresh` moves at
		// each UTC *day* boundary. That only works because every spotlight change is one.
		for (
			let at = Date.UTC(2026, 0, 1);
			at < Date.UTC(2027, 0, 1);
			at += 86_400_000
		) {
			expect(getModeSpotlight(at).changesAtMs % 86_400_000).toBe(0);
		}
	});
});

describe('the strip says what it is', () => {
	it('names the count, the schedule and the date the set next changes', () => {
		expect(describeSpotlightSchedule(getModeSpotlight(SUN_2026_09_06))).toBe(
			'All 8 modes, always. Two are spotlighted each week and one each month — this set changes September 7 (UTC).'
		);
	});

	it('reports the boundary in UTC rather than in whatever zone the reader is in', () => {
		// The rotation turns on a UTC instant. Formatting it locally would name a different day for
		// readers either side of midnight, about the same event.
		const note = describeSpotlightSchedule(getModeSpotlight(Date.UTC(2026, 8, 29, 9)));
		expect(note).toContain('October 1 (UTC)');
	});
});

describe('the two-a-week pair moves the reader on', () => {
	const WEEK_MS = 7 * 86_400_000;

	it('never repeats a mode from one week to the next inside a month', () => {
		// The pair advances by two in a pool of seven, so consecutive weeks are disjoint. Asserted
		// only within a month, because the pool itself changes composition on the first: the
		// month's mode leaves the pool and the previous month's rejoins it, which re-indexes
		// everything. That is a real discontinuity in the walk, not an invariant to assert away.
		for (
			let monday = Date.UTC(2026, 8, 7);
			monday < Date.UTC(2026, 8, 28);
			monday += WEEK_MS
		) {
			const thisWeek = getWeeklyModes(monday).map((mode) => mode.id);
			const nextWeek = getWeeklyModes(monday + WEEK_MS).map((mode) => mode.id);
			expect(
				thisWeek.filter((id) => nextWeek.includes(id)),
				new Date(monday).toISOString()
			).toEqual([]);
		}
	});

	it('gives every mode a week in the spotlight over a year', () => {
		// The claim the replaced comment made — "all 8 modes get equal exposure over time" — with
		// nothing to check it, in code where equal exposure was the *only* thing keeping five of
		// the eight reachable at all. It is still worth holding now that reachability no longer
		// depends on it, because a spotlight that skipped a mode for a year would be a spotlight
		// that quietly stopped being a rotation.
		const seen = new Set<string>();
		for (
			let monday = Date.UTC(2026, 0, 5);
			monday < Date.UTC(2027, 0, 4);
			monday += WEEK_MS
		) {
			for (const mode of getWeeklyModes(monday)) {
				seen.add(mode.id);
			}
		}
		expect(seen.size).toBe(studioModes.length);
	});

	it('leaves the month’s mode out of the week’s pair all month', () => {
		for (
			let monday = Date.UTC(2026, 8, 7);
			monday < Date.UTC(2026, 9, 1);
			monday += WEEK_MS
		) {
			const monthly = getMonthlyMode(monday).id;
			expect(getWeeklyModes(monday).map((mode) => mode.id)).not.toContain(monthly);
		}
	});
});
