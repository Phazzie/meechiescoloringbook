// Purpose: Own the "the reader described a page in their own words -> here is that page" lifecycle
//          for `/describe`, as one testable state class.
// Why: `ChatInterpretationSeam` could turn a sentence into a validated `ColoringPageSpec` from the
//      app's first weeks — pipeline, live billable endpoint, contract tests, browser adapter — and
//      nothing in `src/routes/**` or `src/lib/components/**` ever called it, so the app could not
//      be told what to put on a page. This is the half of the front door that holds state.
// Info flow: reader's sentence -> /api/chat-interpretation -> ColoringPageSpec -> read-back the
//            reader checks -> PageArtifactState.generatePage -> /api/generate -> downloads, print,
//            share, vault.
// Invariants:
//   - An interpretation is one billable call and a picture is another. Nothing here spends the
//     second without the reader pressing a button they could only press after seeing the first,
//     which is what makes showing the read-back worth the round trip at all.
//   - `interpretedFrom` is pinned to the spec it produced and is rendered beside it. The message
//     box stays editable afterwards, so without it the read-back would silently start describing
//     words that are no longer on screen.
//   - The page on screen belongs to the interpretation it was made from. A *successful* new
//     interpretation is the one and only place that stops being true, exactly as a successful
//     verdict is in `VerdictPageState` — a failed one must never destroy a page already paid for.
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import { CHAT_INTERPRETATION_QUOTA_COST } from '$lib/core/ai-quota';
import {
	DESCRIBE_FILE_BASE_SLUG,
	canInterpretMessage,
	describeMessageProblem,
	describeReadbackQuota,
	interpretFailureSentence,
	readBackInterpretedPage,
	styleHintForSpec
} from '$lib/core/describe-page';
import { ChatInterpretationResultSchema } from '$lib/seams/chat-interpretation-seam/contract';
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';
import {
	classifyGenerationFailure,
	READBACK_SUBJECT,
	type GenerationFailure
} from '$lib/core/generation-failure';
import { PageArtifactState } from './page-artifact-state.svelte';

/**
 * How the surface formats the instant a quota window reopens.
 *
 * Passed in rather than chosen here so a test can state the string instead of matching whatever the
 * runner's locale produces, which is the same reason `describeAiQuota` takes a formatter.
 */
export type DescribePageStateOptions = {
	formatTime?: (date: Date) => string;
};

const defaultFormatTime = (date: Date): string =>
	date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export class DescribePageState extends PageArtifactState {
	/** What the reader has typed. Stays editable after an interpretation — see the invariants. */
	message = $state('');
	isInterpreting = $state(false);
	/**
	 * The last failed read-back request, classified.
	 *
	 * `interpretFailureSentence` already gave `/describe` reader-facing sentences for the route's own
	 * failure CODES — the one place in the app that did — but the transport failure a line below it
	 * still wrote the exception's own text, so a reader who lost their connection got `Failed to
	 * fetch` under a surface that otherwise spoke to them properly. Both halves classify here now.
	 */
	interpretFailure = $state<GenerationFailure | null>(null);
	/**
	 * The exact words the last read-back request was sent with, so a retry re-asks them.
	 *
	 * `message` is not that: it is a live field the reader edits while the failure is on screen. This
	 * is the same distinction `interpretedFrom` draws for a read-back that succeeded.
	 */
	private lastAskedMessage: string | null = null;
	/**
	 * The reader-facing sentence for the last read-back failure. Derived, so there is one writer.
	 *
	 * Read by the tests rather than by a surface, as on the other state classes.
	 */
	interpretError = $derived(this.interpretFailure?.message ?? '');

	/** The interpretation currently on screen, or `null` before the first one lands. */
	spec = $state<ColoringPageSpec | null>(null);
	/**
	 * The exact words `spec` was built from.
	 *
	 * Shown beside the read-back. The message box is not cleared or locked after an interpretation,
	 * so this is the only thing that stops "Meechie understood…" from appearing to describe whatever
	 * is in the box right now.
	 */
	interpretedFrom = $state('');

	/**
	 * Cancellation token for an in-flight interpretation.
	 *
	 * Separate from `pageToken` on `PageArtifactState`, because the two lifecycles are cancelled by
	 * different actions: `reset()` abandons an interpretation, while `resetPage()` abandons only
	 * the page. One shared token would let a page reset silently discard an interpretation the
	 * reader is still waiting for.
	 */
	private interpretToken = 0;
	private readonly formatTime: (date: Date) => string;

	constructor(options: DescribePageStateOptions = {}) {
		super({ fileBaseSlug: DESCRIBE_FILE_BASE_SLUG });
		this.formatTime = options.formatTime ?? defaultFormatTime;
	}

	/** What is wrong with the field as typed, or `''` — including for an untouched empty field. */
	messageProblem = $derived(describeMessageProblem(this.message));

	/** What Meechie understood, or `null` when no interpretation is on screen. */
	readback = $derived(this.spec ? readBackInterpretedPage(this.spec) : null);

	/** The quota sentence under the read-back button, priced for a read-back rather than a rewrite. */
	quotaMessage = $derived(
		describeReadbackQuota(this.quota.text, (date) => this.formatTime(date))
	);

	/**
	 * The quota sentence under the "make the page" button — the OTHER bucket.
	 *
	 * `/describe` is the one surface that can ask for up to four pictures, so it is also the one
	 * where pricing a page at a flat unit would be visibly wrong. Priced at the interpretation's own
	 * `variations`, which is exactly what `/api/generate` charges.
	 */
	pageQuotaMessage = $derived(this.quota.pictureMessage(this.picturesPerPage));

	/**
	 * True when the server has told us the bucket cannot fund another read-back.
	 *
	 * Read off the last reading rather than counted locally, and it un-latches on its own: the
	 * `ClockSeam` timer in `setAiQuota` clears the snapshot at its reset instant, so this goes back
	 * to `false` when the window actually reopens rather than when a request is attempted.
	 */
	quotaExhausted = $derived(
		this.quota.textExhausted(CHAT_INTERPRETATION_QUOTA_COST)
	);

	/**
	 * True when pressing "Read it back" would actually send something.
	 *
	 * Gated on the reported quota as well as on the field, because the sentence beside this button
	 * already says the desk is full: leaving it live spends the reader's clicks on requests the
	 * server has already told us it will refuse, and contradicts the line directly under it.
	 */
	get canInterpret(): boolean {
		return (
			canInterpretMessage(this.message) &&
			!this.isInterpreting &&
			!this.isGenerating &&
			!this.quotaExhausted
		);
	}

	/**
	 * True when there is an interpretation to spend a generation on.
	 *
	 * Blocked while an interpretation is in flight for the same reason `makePage` is blocked while a
	 * replacement verdict loads: a successful one calls `resetPage()`, so a generation started in
	 * that window is billed and then discarded.
	 */
	get canMakePage(): boolean {
		return (
			this.spec !== null &&
			!this.isGenerating &&
			!this.isInterpreting &&
			// The server has already said it will refuse this. Leaving the button live spends the
			// reader's clicks on requests that cannot succeed, and contradicts the line beneath it.
			!this.pageQuotaExhausted
		);
	}

	/** `/describe` is the one surface whose page can ask for more than one picture. */
	protected get picturesPerPage(): number {
		return this.spec?.variations ?? 1;
	}

	/** Type into the box. Deliberately does not touch the interpretation — see the invariants. */
	setMessage(value: string): void {
		this.message = value;
	}

	/** Put one of the starter examples in the box, ready to edit. */
	useExample(example: string): void {
		this.message = example;
		this.interpretFailure = null;
	}

	/**
	 * Ask Meechie what page this sentence describes, and show the answer before anything is drawn.
	 *
	 * Nothing on screen is cleared up front: a failed interpretation must leave the previous
	 * read-back and the page made from it exactly where they were, because both were paid for.
	 */
	async interpret(): Promise<void> {
		if (!this.canInterpret) return;
		this.interpretFailure = null;
		this.isInterpreting = true;
		const requestStartedAtMs = this.clock.now();
		// Pinned here, before the await, and never re-read afterwards. `message` is a live field the
		// reader can edit while this is in flight, so captioning the read-back with `this.message`
		// on *arrival* attributes the answer to whatever is in the box a few seconds later — which
		// is the exact drift `interpretedFrom` exists to stop, reintroduced one line further down.
		const asked = this.message.trim();
		this.lastAskedMessage = asked;
		// Claim a fresh token so an abandoned request cannot install itself. `isInterpreting` alone
		// stops two overlapping requests but not `reset()`: a reader who clears the surface while a
		// request is in flight would otherwise watch that answer land on an empty box a moment later.
		this.interpretToken += 1;
		const token = this.interpretToken;
		const isStale = (): boolean => token !== this.interpretToken;
		try {
			const payload = await postJson(
				'/api/chat-interpretation',
				{ message: asked },
				{
					timeoutMs: POST_JSON_TIMEOUTS_MS.tools,
					// Read on every response the route produces, refusals included, because a refusal
					// is exactly when the reader most needs to be told what the limit is and when it
					// lifts. A response without usable quota headers leaves the last reading alone
					// rather than blanking the meter on one odd reply.
					onResponseHeaders: (headers) =>
						this.quota.record(headers, requestStartedAtMs, 'text')
				}
			);
			// The quota reading above is deliberately *not* guarded by this: it describes this
			// caller's bucket, which the server charged whatever the reader did next, so it stays
			// true and useful. Everything below describes a request nobody is waiting for.
			if (isStale()) return;
			const parsed = ChatInterpretationResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.interpretFailure = this.classifyInterpretFailure({ offContract: true });
				return;
			}
			if (!parsed.data.ok) {
				this.interpretFailure = this.classifyInterpretFailure({
					apiError: parsed.data.error
				});
				return;
			}
			// Here, and only here, does what is on screen stop belonging to what is on screen: the
			// page below was generated from the interpretation this one replaces.
			this.resetPage();
			this.spec = parsed.data.value.spec;
			this.interpretedFrom = asked;
		} catch (requestError) {
			if (isStale()) return;
			this.interpretFailure = this.classifyInterpretFailure({
				thrown: requestError
			});
		} finally {
			// Released even for an abandoned request: `reset()` does not clear this flag, and the
			// only request that could clear it is this one — leaving it set would disable the button
			// until a reload.
			this.isInterpreting = false;
		}
	}

	/** Spend a generation on the interpretation the reader has just read and accepted. */
	async makePage(): Promise<void> {
		if (!this.canMakePage) return;
		const spec = this.spec;
		if (!spec) return;
		await this.generatePage({
			// `interpretedFrom`, not `message`: the hint must describe the page the reader approved,
			// and the box is editable after a read-back lands.
			recipe: { spec, styleHint: styleHintForSpec(spec, this.interpretedFrom) },
			// A described page stores no `studioText`. `MeechieStudioTextOutputSchema` requires a
			// `verdict` string, and the reader's own sentence is not one — writing it there would
			// claim Meechie said something she never said, and the vault's own
			// `warrantForRestoredVerdict` exists precisely to tell those apart. See `PageSource`.
			studioText: null,
			headline: spec.title
		});
	}

	/** Clear the box, the interpretation, and the page made from it. */
	reset(): void {
		// Bumping the token is the cancellation: an in-flight request cannot be recalled, but its
		// answer is discarded on arrival instead of landing on a box the reader has just emptied.
		this.interpretToken += 1;
		this.message = '';
		this.interpretFailure = null;
		this.lastAskedMessage = null;
		this.spec = null;
		this.interpretedFrom = '';
		this.resetPage();
	}


	/**
	 * Classify one failed read-back, keeping `/describe`'s own per-code wording.
	 *
	 * The cause and the retry advice come from the shared classifier; the SENTENCE for a failure the
	 * route named itself stays `interpretFailureSentence`'s, which Run 17 wrote for exactly these
	 * codes and which says more than a generic one can — `CHAT_SPEC_INVALID`'s names the field that
	 * failed. Overriding it here rather than teaching the shared module about `/describe` keeps that
	 * wording where it is used and leaves the classifier free of one surface's vocabulary.
	 */
	private classifyInterpretFailure(
		input: Pick<
			Parameters<typeof classifyGenerationFailure>[0],
			'thrown' | 'apiError' | 'offContract'
		>
	): GenerationFailure {
		const failure = classifyGenerationFailure({
			...input,
			subject: READBACK_SUBJECT,
			// A read-back failure never touches the page below, which belongs to the interpretation
			// it has not replaced. See this class's invariants.
			pageKept: false,
			quotaResetAtMs: this.quota.text?.resetAtMs ?? null,
			isOnline: this.readConnection()
		});
		return input.apiError
			? {
					...failure,
					message: interpretFailureSentence({
						// `interpretFailureSentence` switches on a required code; the shared input type
						// makes it optional because not every route names one. An unnamed code falls to
						// its default, which returns the message unchanged — the same thing the shared
						// classifier does with an unknown code.
						code: input.apiError.code ?? '',
						message: input.apiError.message
					})
				}
			: failure;
	}

	/**
	 * Ask for the same read-back again.
	 *
	 * Re-sends the words that were actually asked, not `message`. The box stays editable while the
	 * failure is on screen, so reading it live would send a different sentence under a control that
	 * says "again" — the same drift `interpretedFrom` exists to stop, one control over.
	 */
	async retryInterpret(): Promise<void> {
		const asked = this.lastAskedMessage;
		if (asked === null || this.isInterpreting) return;
		this.message = asked;
		await this.interpret();
	}
}
