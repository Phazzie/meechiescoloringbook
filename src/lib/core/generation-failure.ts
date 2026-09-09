/*
 * Purpose: The one place that decides what a reader is told when an AI call fails, and whether
 *          trying again is worth offering.
 * Why: Every AI call site in the app wrote the caught exception's own message into a crimson box and
 *      called it done — `page-artifact-state.svelte.ts`, `verdict-page-state.svelte.ts`,
 *      `describe-page-state.svelte.ts`, `MeechieTools.svelte` and `studio-state.svelte.ts`, five
 *      independent copies of the same three lines. So a reader who lost their connection was shown
 *      `Failed to fetch`, and a reader who hit a bad gateway was shown
 *      `postJson: HTTP 502 Bad Gateway from /api/generate: empty response body`. Both strings are
 *      addressed to whoever wrote the fetch helper. Meanwhile the app held the facts that would have
 *      helped — `offlineNotice` already words the offline case, and `AiQuotaMeter` already holds the
 *      instant the bucket refills — and never reached for either. Six of the app's own messages tell
 *      the reader to try again and the app has no retry control for them to use.
 * Info flow: thrown error / route refusal / off-contract response / undecodable image
 *            -> classifyGenerationFailure -> GenerationFailure -> GenerationFailureNotice.svelte.
 * Invariants:
 *   - Pure. No clock, no `navigator`, no I/O. The connection reading and the quota reset instant are
 *     passed in by the caller that already holds them.
 *   - A message that reached us from an EXCEPTION is never shown to a reader. A message the SERVER
 *     chose is, because every one of them comes from the allowlist in `public-provider-error.ts` and
 *     was written to be read. That distinction is the whole safety rule of this module.
 *   - The connection reading sharpens a sentence and never decides one. See `classifyThrown`.
 *   - Retry advice is never `now` for a cause where retrying reproduces the same refusal. Offering
 *     one there spends the reader's quota to buy an identical failure.
 */

/**
 * Why an AI call did not produce what was asked for.
 *
 * Coarser than the route error codes on purpose. These are the distinctions that change what a
 * reader should *do*, and nothing else: two codes that mean "wait a moment and press it again" are
 * one cause here, however differently they arose.
 */
export type GenerationFailureCause =
	/** The device has no connection, and we know it. */
	| 'offline'
	/** The request never reached the server, and we do not know whether the connection is the reason. */
	| 'unreachable'
	/** The caller is over quota. The bucket refills on its own. */
	| 'rate_limited'
	/** The request was sent and nothing came back in time. */
	| 'timed_out'
	/** Something cancelled the request before an answer arrived. */
	| 'cancelled'
	/** The AI service answered badly, or not at all. Not the reader's doing and not permanent. */
	| 'provider_unavailable'
	/** The AI service is not set up. No amount of retrying changes that. */
	| 'provider_unconfigured'
	/** The request itself was refused. The same request would be refused again. */
	| 'request_rejected'
	/** An answer arrived that this app could not read. */
	| 'unreadable_response'
	/** A picture arrived that the browser could not decode. */
	| 'unreadable_image'
	/**
	 * The call succeeded and carried no picture at all.
	 *
	 * Distinct from `provider_unavailable`, which means nothing answered, and from
	 * `unreadable_image`, which means something answered with bytes nobody could decode. Here the
	 * words came back and the picture did not, and the app has always said exactly that — a sentence
	 * worth keeping, because it is the only one that tells the reader the text half worked.
	 */
	| 'no_image'
	/** None of the above matched. */
	| 'unknown';

/**
 * Whether pressing a retry control would accomplish anything, and when.
 *
 * A value rather than a boolean because "not now" and "not ever" and "not until you change
 * something" are three different things to a reader, and collapsing them is how an app ends up
 * offering a button that spends a paid generation to reproduce a refusal it already has in hand.
 */
export type RetryAdvice =
	/** Worth pressing immediately. */
	| { readonly kind: 'now' }
	/** Worth pressing once the quota window reopens, at `readyAtMs`. */
	| { readonly kind: 'after'; readonly readyAtMs: number }
	/** Worth pressing once there is a connection again. No instant to name — it is not a timer. */
	| { readonly kind: 'reconnect' }
	/** The request has to change first. Pressing the same one again buys the same refusal. */
	| { readonly kind: 'change_request' }
	/** Nothing the reader can do from here. */
	| { readonly kind: 'none' };

/** Everything a surface needs to render one failed AI call. */
export type GenerationFailure = {
	readonly cause: GenerationFailureCause;
	/**
	 * The sentence the reader sees. Always in the app's voice, never an exception's own text.
	 *
	 * It does not include the wait time for a `rate_limited` failure: the instant belongs to the
	 * retry control, which is the thing the reader is deciding about, and repeating it in both
	 * places is how two renderings of one number come to disagree.
	 */
	readonly message: string;
	readonly retry: RetryAdvice;
	/**
	 * What a retry control for this failure would say.
	 *
	 * Carried on the failure rather than looked up beside it, so a surface renders a notice from one
	 * value and cannot pair one call's failure with another call's label — which on the mode routes,
	 * where a verdict failure and a page failure can both be live, is a real pairing to get wrong.
	 */
	readonly retryLabel: string;
	/** True when a page that was already on screen survived this failure and is still usable. */
	readonly pageKept: boolean;
	/**
	 * The underlying diagnostic — never the reader's sentence.
	 *
	 * Kept rather than discarded because the old behaviour's one virtue was that the real error was
	 * visible *somewhere*, and moving it out of the crimson box must not mean losing it. The home
	 * studio's System Trace renders it under "What Went Wrong Underneath"; the other surfaces have
	 * no diagnostics panel to put it in, and hold it for one to be added.
	 */
	readonly detail: string | null;
};

/** What a surface calls the thing that failed, so one classifier can serve every call site. */
export type FailureSubject = {
	/** The noun, lower case, as it appears mid-sentence: `coloring page`, `verdict`, `read-back`. */
	readonly noun: string;
	/** What the reader would press to try again: `Try this page again`, `Ask Meechie again`. */
	readonly retryLabel: string;
};

export type GenerationFailureInput = {
	/** What the request threw, when it threw. */
	readonly thrown?: unknown;
	/** The contract-shaped refusal the route returned, when it returned one. */
	readonly apiError?: { readonly code?: string; readonly message: string };
	/** True when a response arrived and did not match the route's contract. */
	readonly offContract?: boolean;
	/**
	 * The sentence for a request this app refused to send at all, when it has one of its own.
	 *
	 * Separate from `apiError` because the two are not the same event and must not be worded as
	 * though they were: "please fill in the required fields" is this app declining to spend the
	 * reader's quota, not Meechie refusing the page. Routing it through the code map would produce
	 * "Meechie would not make that verdict: please fill in the required fields", which blames the
	 * wrong party for a form the reader can simply finish. It still classifies as `request_rejected`,
	 * so it correctly offers no retry control against an unchanged input.
	 */
	readonly rejected?: string;
	/** True when the call succeeded and no image in it could be decoded. */
	readonly undecodable?: boolean;
	/**
	 * `navigator.onLine` as the caller last read it, or `null` where nothing has read it.
	 *
	 * `null` is a third state and not a default of `true`, for the same reason `offlineNotice` keeps
	 * it: "not asked" and "asked, and the connection is up" are different facts.
	 */
	readonly isOnline?: boolean | null;
	/**
	 * When the quota bucket this call spends refills, from the reading the surface already holds.
	 *
	 * Available because `postJson` hands the response headers to the quota meter *before* it reads
	 * the body (`http-client.ts`), so by the time a 429's body has been parsed into `apiError` the
	 * meter has already recorded that same response's `Retry-After`. That ordering is what lets a
	 * rate-limit failure name the instant instead of saying "the current window".
	 */
	readonly quotaResetAtMs?: number | null;
	/** Whether a page that was already on screen survived. */
	readonly pageKept?: boolean;
	readonly subject: FailureSubject;
};

/** The subjects the app's surfaces use, named once so two surfaces cannot word the same thing twice. */
export const PAGE_SUBJECT: FailureSubject = {
	noun: 'coloring page',
	retryLabel: 'Try this page again'
};

export const VERDICT_SUBJECT: FailureSubject = {
	noun: 'verdict',
	retryLabel: 'Ask Meechie again'
};

export const READBACK_SUBJECT: FailureSubject = {
	noun: 'read-back',
	retryLabel: 'Read it back again'
};

export const TRY_ON_SUBJECT: FailureSubject = {
	noun: 'try-on',
	retryLabel: 'Try the wig again'
};

/**
 * Route error codes grouped by what the reader should do about them.
 *
 * Every code here is one `public-provider-error.ts`, `rate-limit-guard.ts` or a route's own contract
 * can actually emit. A code that is not listed falls through to `unknown`, which still offers a
 * retry and still shows the server's own message — so a route that adds a code keeps working and
 * merely stops being *specific*, rather than losing its message to a generic sentence.
 */
export const CAUSE_BY_CODE: Readonly<Record<string, GenerationFailureCause>> = {
	RATE_LIMITED: 'rate_limited',

	// Temporary and not the reader's doing. `RATE_LIMIT_UNAVAILABLE` belongs here rather than with
	// the misconfigurations: the guard returns it for a Redis call that failed as readily as for a
	// half-written configuration, and the first of those clears on its own.
	RATE_LIMIT_UNAVAILABLE: 'provider_unavailable',
	PROVIDER_HTTP_ERROR: 'provider_unavailable',
	PROVIDER_NETWORK_ERROR: 'provider_unavailable',
	PROVIDER_EMPTY_IMAGE: 'no_image',
	IMAGE_HTTP_ERROR: 'provider_unavailable',
	IMAGE_NETWORK_ERROR: 'provider_unavailable',
	IMAGE_EMPTY_RESPONSE: 'no_image',
	MEECHIE_VOICE_PACK_ERROR: 'provider_unavailable',
	MEECHIE_TOOL_PROVIDER_ERROR: 'provider_unavailable',
	WIG_TRY_ON_HTTP_ERROR: 'provider_unavailable',
	WIG_TRY_ON_NETWORK_ERROR: 'provider_unavailable',
	WIG_TRY_ON_EMPTY_RESPONSE: 'provider_unavailable',

	// Nobody pressing a button can fix a missing key.
	PROVIDER_API_KEY_MISSING: 'provider_unconfigured',
	IMAGE_CONFIG_ERROR: 'provider_unconfigured',
	WIG_TRY_ON_CONFIG_ERROR: 'provider_unconfigured',

	IMAGE_TIMEOUT_ERROR: 'timed_out',
	WIG_TRY_ON_TIMEOUT_ERROR: 'timed_out',

	IMAGE_ABORTED: 'cancelled',
	WIG_TRY_ON_ABORTED: 'cancelled',
	CHAT_ABORTED: 'cancelled',

	// The request is the problem, so the same request is not worth sending again.
	IMAGE_VALIDATION_ERROR: 'request_rejected',
	WIG_TRY_ON_VALIDATION_ERROR: 'request_rejected',
	CHAT_INPUT_INVALID: 'request_rejected',
	CHAT_SPEC_INVALID: 'request_rejected',

	// An answer arrived and could not be read. Worth one more try: these are usually one bad
	// completion rather than a standing condition.
	CHAT_RESPONSE_INVALID: 'unreadable_response',
	CHAT_OUTPUT_INVALID: 'unreadable_response',
	MEECHIE_TOOL_PROVIDER_INVALID: 'unreadable_response',
	MEECHIE_STUDIO_TEXT_PROVIDER_INVALID: 'unreadable_response',
	WIG_TRY_ON_PARSE_ERROR: 'unreadable_response'
};

/** The exception text `postJson` produces for a request that ran out of time. */
const TIMEOUT_MARKER = 'Request timed out after';

/**
 * The exception text `postJson` prefixes onto every HTTP-shaped failure it raises itself.
 *
 * Matched so those can be told apart from a `fetch` rejection: a `postJson:` message means a
 * response genuinely arrived and was unusable, which is a different thing from never reaching the
 * server, and the reader is told a different sentence for each.
 */
const POST_JSON_MARKER = 'postJson:';

const messageOf = (thrown: unknown): string =>
	thrown instanceof Error
		? thrown.message
		: typeof thrown === 'string'
			? thrown
			: '';

/**
 * Classify something that was thrown rather than returned.
 *
 * The order here is the module's most important decision. The **exception shape** decides the cause;
 * the connection reading only ever upgrades `unreachable` to `offline`. Doing it the other way
 * round — trusting `navigator.onLine` first — misclassifies the two cases that matter most: a
 * captive portal and a failed DNS lookup both report the device as online while no request can
 * leave it, and a reader told "the service is having trouble" there will retry into a wall for as
 * long as they have patience. Reading it second means the worst an unhelpful `onLine` can do is
 * leave the sentence one degree less specific than it might have been.
 */
const classifyThrown = (
	thrown: unknown,
	isOnline: boolean | null
): GenerationFailureCause => {
	const message = messageOf(thrown);
	if (message.includes(TIMEOUT_MARKER)) return 'timed_out';
	// A response arrived; it was the response that was unusable, not the connection.
	if (message.includes(POST_JSON_MARKER)) return 'unreadable_response';
	// Everything else that escapes `fetch` is a request that did not complete. `TypeError` is what
	// browsers raise for it, but the check is deliberately not `instanceof TypeError`: a proxy, an
	// extension or a polyfill can raise something else for the same condition, and the sentence for
	// "we could not reach the server" is right for all of them.
	return isOnline === false ? 'offline' : 'unreachable';
};

const retryFor = (
	cause: GenerationFailureCause,
	quotaResetAtMs: number | null
): RetryAdvice => {
	switch (cause) {
		case 'rate_limited':
			// Only when the instant is actually known. Without a reading there is nothing to count
			// down to, and a control that says "ready at Invalid Date" is worse than one that just
			// waits for the reader to decide.
			return quotaResetAtMs !== null && Number.isFinite(quotaResetAtMs)
				? { kind: 'after', readyAtMs: quotaResetAtMs }
				: { kind: 'now' };
		case 'offline':
			return { kind: 'reconnect' };
		case 'request_rejected':
			return { kind: 'change_request' };
		case 'provider_unconfigured':
			return { kind: 'none' };
		default:
			return { kind: 'now' };
	}
};

const sentenceFor = (
	cause: GenerationFailureCause,
	subject: FailureSubject,
	serverMessage: string | null,
	pageKept: boolean
): string => {
	const kept = pageKept ? ' The page already on screen was kept.' : '';
	switch (cause) {
		case 'offline':
			// Deliberately in step with `offlineNotice`, which says the same thing in the banner: what
			// is on this device still works, and a new one needs a connection. Two sentences about
			// being offline that disagree would be worse than one of them being absent.
			return `You are offline, so Meechie cannot make a new ${subject.noun}. Everything already on this device still opens.${kept}`;
		case 'unreachable':
			return `The app could not reach Meechie, so the ${subject.noun} was not made. Check your connection and try again.${kept}`;
		case 'rate_limited':
			return `Meechie's desk is full — this ${subject.noun} would be refused right now.${kept}`;
		case 'timed_out':
			return `Meechie took too long and the ${subject.noun} was not made. This usually works on a second try.${kept}`;
		case 'cancelled':
			return `That ${subject.noun} was cancelled before Meechie finished it.${kept}`;
		case 'provider_unavailable':
			return `Meechie's art service did not answer, so the ${subject.noun} was not made. It usually clears in a moment.${kept}`;
		case 'provider_unconfigured':
			return `Meechie's art service is not set up on this site, so no ${subject.noun} can be made. This is not something you can fix from here.${kept}`;
		case 'request_rejected':
			// The server's own message is the useful half here: it names the field or rule that was
			// refused, and the reader has to change something to get past it. This is the one cause
			// where a bare sentence of ours would leave them with nothing to act on.
			return serverMessage
				? `Meechie would not make that ${subject.noun}: ${serverMessage}`
				: `Meechie would not make that ${subject.noun}. Change what you asked for and try again.`;
		case 'unreadable_response':
			return `Meechie answered with something this app could not read, so the ${subject.noun} was not made. Try again, or say it a different way.${kept}`;
		case 'no_image':
			return `Meechie sent the words back without a picture. Try creating the ${subject.noun} again.${kept}`;
		case 'unreadable_image':
			return `The picture that came back could not be read, so it was not put on a ${subject.noun}.${kept}`;
		default:
			// An unrecognised code from a route that has one. Its message came through
			// `toPublicProviderError`'s allowlist and was written for a reader, so it is shown; a
			// generic sentence here would throw away the most specific thing anyone knows.
			return serverMessage
				? `${serverMessage}${kept}`
				: `Meechie could not make that ${subject.noun}. Try again in a moment.${kept}`;
	}
};

/**
 * Turn one failed AI call into what the reader is told and what they are offered.
 *
 * The branches are ordered by how much is actually known, most to least: an undecodable image means
 * the call succeeded and was billed, a route refusal means the server spoke and named its own
 * reason, an off-contract response means something arrived, and a throw means the least of all. Any
 * other order would let a weaker signal overwrite a stronger one — most importantly, it would let
 * the connection reading override a refusal the server had already given us in writing.
 */
export const classifyGenerationFailure = (
	input: GenerationFailureInput
): GenerationFailure => {
	const pageKept = input.pageKept === true;
	const quotaResetAtMs = input.quotaResetAtMs ?? null;

	const build = (
		cause: GenerationFailureCause,
		serverMessage: string | null,
		detail: string | null
	): GenerationFailure => ({
		cause,
		message: sentenceFor(cause, input.subject, serverMessage, pageKept),
		retry: retryFor(cause, quotaResetAtMs),
		retryLabel: input.subject.retryLabel,
		pageKept,
		detail
	});

	if (input.undecodable === true) {
		return build('unreadable_image', null, null);
	}

	// Before the route branches: nothing was sent, so there is no server answer for them to read.
	if (input.rejected !== undefined) {
		return {
			cause: 'request_rejected',
			// Verbatim. The caller's sentence is already about the reader's own input and adding
			// "Meechie would not make that…" in front of it would blame her for a form they can finish.
			message: input.rejected,
			retry: { kind: 'change_request' },
			retryLabel: input.subject.retryLabel,
			pageKept,
			detail: null
		};
	}

	if (input.apiError) {
		const code = input.apiError.code ?? '';
		const cause = CAUSE_BY_CODE[code] ?? 'unknown';
		return build(
			cause,
			input.apiError.message,
			code ? `${code}: ${input.apiError.message}` : input.apiError.message
		);
	}

	if (input.offContract === true) {
		return build('unreadable_response', null, 'Response did not match contract.');
	}

	if (input.thrown !== undefined) {
		const cause = classifyThrown(input.thrown, input.isOnline ?? null);
		// The exception's own text goes to `detail` and never to `message`. This line is the module's
		// reason for existing: it is exactly where `Failed to fetch` and
		// `postJson: HTTP 502 …: empty response body` used to become the reader's sentence.
		return build(cause, null, messageOf(input.thrown) || null);
	}

	return build('unknown', null, null);
};

/**
 * The words on the retry control, or `null` when no control should be offered.
 *
 * `change_request` and `none` return `null`: the first because the reader has to edit something
 * before a retry means anything, the second because nothing they do from here helps. Rendering a
 * button in either case would spend a paid generation to buy the identical failure back.
 */
export const retryControlLabel = (failure: GenerationFailure): string | null =>
	failure.retry.kind === 'change_request' || failure.retry.kind === 'none'
		? null
		: failure.retryLabel;

/**
 * When the retry control becomes usable, as a wall-clock time, or `''` when it is usable now.
 *
 * A clock time rather than a countdown, for the same reason `formatQuotaResetTime` gives: this app
 * has no ticker, so a rendered "ready in 34s" is wrong 34 seconds later, while an instant stays true
 * for as long as it is on screen.
 */
export const describeRetryWait = (
	failure: GenerationFailure,
	formatTime: (date: Date) => string
): string =>
	failure.retry.kind === 'after'
		? `Ready again at ${formatTime(new Date(failure.retry.readyAtMs))}.`
		: '';

/**
 * Whether the retry control should be usable, given the clock and the connection.
 *
 * Both facts are passed in because both can change while the notice is on screen without anything
 * else about the failure changing: a quota window reopens on a timer, and a connection returns on an
 * `online` event. A control that could only be re-evaluated by re-running the request would hold a
 * reader out of a window that had already reopened — which is the defect `AiQuotaMeter`'s expiry
 * timer exists to prevent one control over.
 *
 * `isOnline` of `null` — nothing has read it — enables a `reconnect` retry rather than blocking it.
 * The reader saw a failure that says they are offline; if we cannot confirm they still are, refusing
 * the button leaves them stuck at a sentence with no way past it, and the cost of letting a doomed
 * retry through is one more of the same message.
 */
export const canRetryAt = (
	failure: GenerationFailure,
	nowMs: number,
	isOnline: boolean | null = null
): boolean => {
	switch (failure.retry.kind) {
		case 'now':
			return true;
		case 'after':
			return nowMs >= failure.retry.readyAtMs;
		case 'reconnect':
			return isOnline !== false;
		default:
			return false;
	}
};
