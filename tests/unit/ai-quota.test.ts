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

// Every delta header is relative to the instant the quota was CHARGED, which is server-side. The
// client only knows when it sent the request; on `/api/wig-try-on` the route fetches an external
// image before charging, so anchoring the delta to the send instant computes a reset that is early
// by all of that work — and early is the harmful direction, since it invites a refused retry.
describe('readAiQuota reset anchoring', () => {
	it('prefers the server absolute instant over the delta', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '5',
				'RateLimit-Reset': '30',
				'RateLimit-Reset-At': String(NOW + 42_000)
			}),
			NOW,
			{ bucket: 'image' }
		);

		// Not NOW + 30_000: the server said when, so the client does not compute it.
		expect(snapshot?.resetAtMs).toBe(NOW + 42_000);
	});

	it('falls back to the delta when the server sent no absolute instant', () => {
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

	it('ignores an unusable absolute instant rather than trusting it', () => {
		const snapshot = readAiQuota(
			headers({
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '5',
				'RateLimit-Reset': '30',
				'RateLimit-Reset-At': 'soon'
			}),
			NOW,
			{ bucket: 'image' }
		);

		expect(snapshot?.resetAtMs).toBe(NOW + 30_000);
	});
});
