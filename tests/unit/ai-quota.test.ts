// Purpose: Unit tests for reading the server's own AI quota out of its response headers.
// Why: The studio used to show an invented counter. Every rule that turns real headers into the
//      number on screen is pinned here, including the ones that decide to show nothing at all.
// Info flow: header fixtures -> readAiQuota/aiActionsLeft/describeAiQuota -> assertions.
import { describe, expect, it } from 'vitest';
import {
	STUDIO_TEXT_QUOTA_COST,
	aiActionsLeft,
	describeAiQuota,
	readAiQuota
} from '../../src/lib/core/ai-quota';

const NOW = 1_760_000_000_000;

/** The header shape the rate-limit guard actually emits, so a test cannot drift from the server. */
const headers = (values: Record<string, string>): Headers => new Headers(values);

/** Fixed formatter, so an assertion is about the sentence and not about the test runner's locale. */
const atClock = (date: Date): string => `T+${(date.getTime() - NOW) / 1_000}s`;

describe('readAiQuota', () => {
	it('reads a full header set into an absolute reset instant', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '20',
				'RateLimit-Remaining': '14',
				'RateLimit-Reset': '45'
			}),
			NOW,
			{ bucket: 'text' }
		);

		expect(snapshot).toEqual({
			bucket: 'text',
			limit: 20,
			remaining: 14,
			resetAtMs: NOW + 45_000,
			exhausted: false
		});
	});

	it('prefers Retry-After and marks the reading exhausted when the response was a refusal', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '20',
				'RateLimit-Remaining': '0',
				'RateLimit-Reset': '30',
				'Retry-After': '31'
			}),
			NOW,
			{ bucket: 'text' }
		);

		// The refusal's own number wins: it is the one computed for this caller's denial.
		expect(snapshot?.resetAtMs).toBe(NOW + 31_000);
		expect(snapshot?.exhausted).toBe(true);
	});

	// Showing a guessed number is the failure this whole module exists to end, so every unusable
	// header set has to come back as "say nothing" rather than as a default.
	it.each([
		['no headers at all', {}],
		['limit missing', { 'RateLimit-Remaining': '4', 'RateLimit-Reset': '10' }],
		['remaining missing', { 'RateLimit-Limit': '20', 'RateLimit-Reset': '10' }],
		['reset missing', { 'RateLimit-Limit': '20', 'RateLimit-Remaining': '4' }],
		[
			'a non-numeric count',
			{ 'RateLimit-Limit': '20', 'RateLimit-Remaining': 'lots', 'RateLimit-Reset': '10' }
		],
		[
			'a negative count',
			{ 'RateLimit-Limit': '20', 'RateLimit-Remaining': '-1', 'RateLimit-Reset': '10' }
		],
		[
			'a fractional count',
			{ 'RateLimit-Limit': '20', 'RateLimit-Remaining': '4.5', 'RateLimit-Reset': '10' }
		],
		[
			'an empty value',
			{ 'RateLimit-Limit': '20', 'RateLimit-Remaining': '', 'RateLimit-Reset': '10' }
		],
		[
			'more remaining than the bucket holds',
			{ 'RateLimit-Limit': '20', 'RateLimit-Remaining': '21', 'RateLimit-Reset': '10' }
		]
	])('reports nothing for %s', (_label, values) => {
		expect(readAiQuota(headers(values), NOW, { bucket: 'text' })).toBeNull();
	});

	it('accepts an exhausted flag from the caller for a refusal that carried no Retry-After', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '20',
				'RateLimit-Remaining': '1',
				'RateLimit-Reset': '12'
			}),
			NOW,
			{ bucket: 'text', exhausted: true }
		);

		expect(snapshot?.exhausted).toBe(true);
	});
});

describe('aiActionsLeft', () => {
	it('divides remaining units by what one action costs', () => {
		expect(STUDIO_TEXT_QUOTA_COST).toBe(2);
		expect(aiActionsLeft({ bucket: 'text', limit: 20, remaining: 14, resetAtMs: NOW, exhausted: false })).toBe(7);
		expect(aiActionsLeft({ bucket: 'text', limit: 20, remaining: 20, resetAtMs: NOW, exhausted: false })).toBe(10);
	});

	// A bucket holding one unit is not empty, but it cannot pay for a two-unit action. Reporting
	// "1 left" there would promise a call the very next request refuses.
	it('reports nothing left when the units cannot pay for a whole action', () => {
		expect(aiActionsLeft({ bucket: 'text', limit: 20, remaining: 1, resetAtMs: NOW, exhausted: false })).toBe(0);
		expect(aiActionsLeft({ bucket: 'text', limit: 20, remaining: 0, resetAtMs: NOW, exhausted: false })).toBe(0);
	});
});

describe('describeAiQuota', () => {
	it('says nothing at all before the server has reported a quota', () => {
		expect(describeAiQuota(null, atClock)).toBe('');
	});

	it('counts the calls left and names the instant they stop mattering', () => {
		expect(
			describeAiQuota({ bucket: 'text', limit: 20, remaining: 14, resetAtMs: NOW + 45_000, exhausted: false }, atClock)
		).toBe('7 AI calls left before T+45s.');
	});

	it('keeps the count singular when one call is left', () => {
		expect(
			describeAiQuota({ bucket: 'text', limit: 20, remaining: 2, resetAtMs: NOW + 10_000, exhausted: false }, atClock)
		).toBe('1 AI call left before T+10s.');
	});

	it('tells a stopped reader when they can come back', () => {
		expect(
			describeAiQuota({ bucket: 'text', limit: 20, remaining: 0, resetAtMs: NOW + 31_000, exhausted: true }, atClock)
		).toBe("Meechie's desk is full. Ready again at T+31s.");
	});
});

// The reset instant is computed from the CALLER's clock and a delta, never from a server
// timestamp: the two clocks are unrelated, and a skewed device would otherwise treat a fresh window
// as expired (or hold controls disabled long after the bucket refilled). An earlier head of this
// branch preferred a server-sent `RateLimit-Reset-At`; it was reverted for exactly that reason.
describe('readAiQuota reset anchoring', () => {
	it('derives the instant from the caller clock and the delta', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '5',
				'RateLimit-Reset': '30'
			}),
			NOW,
			{ bucket: 'image' }
		);

		expect(snapshot?.resetAtMs).toBe(NOW + 30_000);
	});

	// A server epoch value must not be able to steer the client's timeline, however it arrives.
	it('ignores a server timestamp header entirely', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '5',
				'RateLimit-Reset': '30',
				'RateLimit-Reset-At': String(NOW + 9_000_000)
			}),
			NOW,
			{ bucket: 'image' }
		);

		expect(snapshot?.resetAtMs).toBe(NOW + 30_000);
	});

	// `Retry-After` is still the authority on a refusal — it is a delta too, so it stays on the
	// caller's clock.
	it('prefers Retry-After on a denial, still as a delta', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '0',
				'RateLimit-Reset': '30',
				'Retry-After': '35'
			}),
			NOW,
			{ bucket: 'image' }
		);

		expect(snapshot?.resetAtMs).toBe(NOW + 35_000);
		expect(snapshot?.exhausted).toBe(true);
	});
});
