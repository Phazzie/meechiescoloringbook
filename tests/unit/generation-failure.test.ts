/*
 * Purpose: Prove what a reader is told when an AI call fails, and what they are offered.
 * Why: The behaviour being replaced was five copies of "show the exception's own message", so the
 *      assertions that matter most are the negative ones — that a developer's string never becomes
 *      the reader's sentence — and the ones about the retry control, which must never invite a
 *      reader to spend a paid generation reproducing a refusal already in hand.
 * Info flow: classifyGenerationFailure inputs -> GenerationFailure -> the notice's three questions.
 * Invariants: Every assertion here is about a decision `generation-failure.ts` owns. Nothing in this
 *             file touches the network, a clock or a DOM.
 */
import { describe, expect, it } from 'vitest';
import {
	CAUSE_BY_CODE,
	canRetryAt,
	classifyGenerationFailure,
	describeRetryWait,
	PAGE_SUBJECT,
	READBACK_SUBJECT,
	retryControlLabel,
	VERDICT_SUBJECT,
	type GenerationFailure,
	type GenerationFailureCause
} from '$lib/core/generation-failure';
import { PUBLIC_PROVIDER_ERROR_MESSAGES } from '$lib/core/public-provider-error';

const classify = (
	input: Partial<Parameters<typeof classifyGenerationFailure>[0]> = {}
) => classifyGenerationFailure({ subject: PAGE_SUBJECT, ...input });

/**
 * Every developer-facing string the old behaviour actually put in front of readers.
 *
 * Two are real: `Failed to fetch` is what a browser raises when a request cannot leave the device,
 * and the `postJson:` line is built by the app's own fetch helper. The others are the shapes a
 * provider, a proxy or a runtime can raise on the same path.
 */
const DEVELOPER_STRINGS = [
	'Failed to fetch',
	'NetworkError when attempting to fetch resource.',
	'postJson: HTTP 502 Bad Gateway from /api/generate: empty response body',
	'postJson: failed to parse JSON response from /api/generate (HTTP 200 OK): Unexpected token <',
	'Load failed',
	'terminated',
	'read ECONNRESET'
];

describe('classifying a thrown request', () => {
	it('never shows the exception text, and keeps it as detail', () => {
		for (const text of DEVELOPER_STRINGS) {
			const failure = classify({ thrown: new Error(text) });
			expect(failure.message).not.toContain(text);
			expect(failure.detail).toBe(text);
			// Whatever it was, the reader is left with a usable sentence rather than a fragment.
			expect(failure.message.length).toBeGreaterThan(20);
			expect(failure.message.endsWith('.')).toBe(true);
		}
	});

	it('reads a timeout off the sentence the fetch helper writes', () => {
		const failure = classify({
			thrown: new Error(
				'Request timed out after 180s. The AI took too long to respond - please try again.'
			)
		});
		expect(failure.cause).toBe('timed_out');
		expect(failure.retry.kind).toBe('now');
	});

	it('tells a response that arrived and was unusable from one that never arrived', () => {
		// A `postJson:` message means a response genuinely came back. Classifying it as a connection
		// failure would tell the reader to check a connection that is working.
		expect(
			classify({
				thrown: new Error('postJson: HTTP 502 Bad Gateway from /api/generate: x')
			}).cause
		).toBe('unreadable_response');
		expect(classify({ thrown: new TypeError('Failed to fetch') }).cause).toBe(
			'unreachable'
		);
	});

	it('lets the connection reading sharpen the sentence and never decide it', () => {
		// The same throw, three connection readings. Offline is the only one that changes the cause,
		// and the other two still produce a sentence the reader can act on. A captive portal and a
		// failed DNS lookup both report the device as online, which is why `unreachable` — not
		// "everything is fine" — is what an online reading yields here.
		const thrown = new TypeError('Failed to fetch');
		expect(classify({ thrown, isOnline: false }).cause).toBe('offline');
		expect(classify({ thrown, isOnline: true }).cause).toBe('unreachable');
		expect(classify({ thrown, isOnline: null }).cause).toBe('unreachable');
		expect(classify({ thrown, isOnline: false }).message).toContain('offline');
		expect(classify({ thrown, isOnline: true }).message).toContain(
			'could not reach'
		);
	});

	it('classifies a non-Error throw without inventing a detail', () => {
		const failure = classify({ thrown: { weird: true } });
		expect(failure.cause).toBe('unreachable');
		expect(failure.detail).toBeNull();
		expect(failure.message).toContain('could not reach');
	});
});

describe('classifying what the server said', () => {
	it('names the wait for a rate limit and does not offer an immediate retry', () => {
		const failure = classify({
			apiError: {
				code: 'RATE_LIMITED',
				message: 'Too many requests. Try again after the current window resets.'
			},
			quotaResetAtMs: 1_000_000
		});
		expect(failure.cause).toBe('rate_limited');
		expect(failure.retry).toEqual({ kind: 'after', readyAtMs: 1_000_000 });
		expect(canRetryAt(failure, 999_999)).toBe(false);
		expect(canRetryAt(failure, 1_000_000)).toBe(true);
		expect(describeRetryWait(failure, () => '3:42:55')).toBe(
			'Ready again at 3:42:55.'
		);
	});

	it('falls back to an immediate retry when no reset instant is known', () => {
		// Without a reading there is nothing to count down to. A control that says "ready at Invalid
		// Date", or one held shut against an instant nobody has, is worse than one the reader decides.
		const failure = classify({
			apiError: { code: 'RATE_LIMITED', message: 'Too many requests.' },
			quotaResetAtMs: null
		});
		expect(failure.retry.kind).toBe('now');
		expect(describeRetryWait(failure, () => 'never used')).toBe('');
	});

	it('offers no retry for a service that is not configured', () => {
		const failure = classify({
			apiError: {
				code: 'PROVIDER_API_KEY_MISSING',
				message: 'AI provider is not configured.'
			}
		});
		expect(failure.cause).toBe('provider_unconfigured');
		expect(failure.retry.kind).toBe('none');
		expect(retryControlLabel(failure)).toBeNull();
		expect(failure.message).toContain('not something you can fix');
	});

	it('keeps the message for a refused request, because it names what to change', () => {
		const failure = classify({
			apiError: { code: 'CHAT_SPEC_INVALID', message: 'Title too long' },
			subject: READBACK_SUBJECT
		});
		expect(failure.cause).toBe('request_rejected');
		expect(failure.message).toContain('Title too long');
		expect(failure.retry.kind).toBe('change_request');
		// The same request would be refused identically, so there is nothing to press.
		expect(retryControlLabel(failure)).toBeNull();
	});

	it('shows an unknown code its own message rather than swallowing it', () => {
		// A route that adds a code keeps working and merely stops being specific. Its message came
		// through the public allowlist and was written for a reader.
		const failure = classify({
			apiError: { code: 'SOMETHING_NEW', message: 'Meechie is redecorating.' }
		});
		expect(failure.cause).toBe('unknown');
		expect(failure.message).toContain('Meechie is redecorating.');
		expect(failure.detail).toBe('SOMETHING_NEW: Meechie is redecorating.');
	});

	it('tells "no picture came back" from "nothing answered"', () => {
		// Three different things the app used to word as one or two. The words came back and the
		// picture did not, which is the only one of the three that tells the reader the text half
		// worked — a sentence the home studio already had and which a generic one would have lost.
		expect(
			classify({ apiError: { code: 'PROVIDER_EMPTY_IMAGE', message: 'x' } }).cause
		).toBe('no_image');
		expect(
			classify({ apiError: { code: 'IMAGE_HTTP_ERROR', message: 'x' } }).cause
		).toBe('provider_unavailable');
		expect(classify({ undecodable: true }).cause).toBe('unreadable_image');
	});

	it('classifies every code the app can actually return', () => {
		// The drift guard: a code added to the public allowlist without a cause here would ship as a
		// generic sentence with a retry answer that may be wrong for it.
		const unclassified = Object.keys(PUBLIC_PROVIDER_ERROR_MESSAGES).filter(
			(code) => CAUSE_BY_CODE[code] === undefined
		);
		expect(unclassified).toEqual([]);
	});
});

describe('the request this app refused to send', () => {
	it('uses the caller sentence verbatim and blames nobody for it', () => {
		const failure = classify({
			rejected: 'Please complete the required fields before asking Meechie.',
			subject: VERDICT_SUBJECT
		});
		expect(failure.message).toBe(
			'Please complete the required fields before asking Meechie.'
		);
		// Not "Meechie would not make that verdict: please complete…", which blames her for a form
		// the reader can simply finish.
		expect(failure.message).not.toContain('Meechie would not');
		expect(failure.retry.kind).toBe('change_request');
		expect(failure.detail).toBeNull();
	});
});

describe('what a failure is allowed to overwrite', () => {
	it('lets an undecodable image outrank everything else', () => {
		// The call succeeded and was billed. Reporting it as a transport failure would tell a reader
		// their connection ate a generation that the server had in fact delivered.
		const failure = classify({
			undecodable: true,
			thrown: new Error('Failed to fetch'),
			apiError: { code: 'RATE_LIMITED', message: 'Too many requests.' },
			isOnline: false
		});
		expect(failure.cause).toBe('unreadable_image');
	});

	it('lets a refusal the server wrote outrank the connection reading', () => {
		// If the server answered, we were not offline at the moment that mattered. Reading `isOnline`
		// first would relabel a quota refusal as a lost connection and send the reader to their
		// router instead of to the clock.
		const failure = classify({
			apiError: { code: 'RATE_LIMITED', message: 'Too many requests.' },
			isOnline: false,
			quotaResetAtMs: 5_000
		});
		expect(failure.cause).toBe('rate_limited');
	});
});

describe('what the reader is told about the page below', () => {
	it('says a surviving page survived, and stays silent when there is none', () => {
		const kept = classify({ thrown: new Error('Failed to fetch'), pageKept: true });
		expect(kept.message).toContain('already on screen was kept');
		const none = classify({ thrown: new Error('Failed to fetch') });
		expect(none.message).not.toContain('kept');
	});
});

describe('the retry control', () => {
	it('waits for the connection rather than the clock when the reader is offline', () => {
		const failure = classify({
			thrown: new TypeError('Failed to fetch'),
			isOnline: false
		});
		expect(failure.retry.kind).toBe('reconnect');
		// Offered, so it is already on screen the moment the connection returns.
		expect(retryControlLabel(failure)).toBe(PAGE_SUBJECT.retryLabel);
		expect(canRetryAt(failure, Date.now(), false)).toBe(false);
		expect(canRetryAt(failure, Date.now(), true)).toBe(true);
		// An unknown connection enables it: the reader would otherwise be stuck at a sentence with
		// no way past it, and the cost of a doomed press is one more of the same message.
		expect(canRetryAt(failure, Date.now(), null)).toBe(true);
	});

	it('carries the label of the thing that failed, not of the surface', () => {
		// A mode route shows a verdict failure and a page failure on one screen, so the label has to
		// travel with the failure rather than be looked up beside it.
		expect(
			retryControlLabel(classify({ thrown: new Error('x'), subject: VERDICT_SUBJECT }))
		).toBe('Ask Meechie again');
		expect(
			retryControlLabel(classify({ thrown: new Error('x'), subject: PAGE_SUBJECT }))
		).toBe('Try this page again');
	});

	it('offers a way back for every cause a reader could clear themselves', () => {
		// The causes where pressing again is genuinely worth it.
		const causeOf = {
			unreachable: () => classify({ thrown: new TypeError('Failed to fetch') }),
			timed_out: () =>
				classify({ apiError: { code: 'IMAGE_TIMEOUT_ERROR', message: 'x' } }),
			cancelled: () =>
				classify({ apiError: { code: 'IMAGE_ABORTED', message: 'x' } }),
			provider_unavailable: () =>
				classify({ apiError: { code: 'IMAGE_HTTP_ERROR', message: 'x' } }),
			unreadable_response: () => classify({ offContract: true }),
			no_image: () =>
				classify({ apiError: { code: 'PROVIDER_EMPTY_IMAGE', message: 'x' } }),
			unreadable_image: () => classify({ undecodable: true }),
			unknown: () => classify({})
			// Keyed by the contract's own cause names, so a renamed cause fails compilation here
			// rather than silently dropping out of this sweep.
		} satisfies Partial<Record<GenerationFailureCause, () => GenerationFailure>>;

		// Stated as a list so a future cause has to be placed deliberately on one side or the other.
		const clearable: (keyof typeof causeOf)[] = [
			'unreachable',
			'timed_out',
			'cancelled',
			'provider_unavailable',
			'unreadable_response',
			'no_image',
			'unreadable_image',
			'unknown'
		];
		for (const cause of clearable) {
			const failure = causeOf[cause]();
			expect(failure.cause).toBe(cause);
			expect(failure.retry.kind).toBe('now');
			expect(canRetryAt(failure, 0)).toBe(true);
			expect(retryControlLabel(failure)).not.toBeNull();
		}
	});
});
