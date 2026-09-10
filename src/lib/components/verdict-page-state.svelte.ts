// Purpose: Own the "Meechie ruled on it -> here is your coloring page" lifecycle for the standalone
//          mode routes, as one testable state class.
// Why: `/who-fucked-up`, `/rate-his-excuse` and `/random` are three of the app's nav destinations,
//      and each carried its own ~90-line copy of this flow. All three copies flattened every
//      verdict into a title-only page, threw the drift report away, could not save anything to the
//      vault, and packaged the print and share files in one call so a browser that could not encode
//      the share image lost the printable PDF with it. Fixing that once, here, is the only way it
//      stays fixed.
// Info flow: tool input -> /api/tools -> verdict -> buildToolPageRecipe -> PageArtifactState.
// Invariants: The verdict half is all this file owns. Everything from the spec onwards —
//             generation, decoding, installation, packaging, the export row, the drift report and
//             the vault write — lives in `PageArtifactState`, which `/describe` extends too, so a
//             fix to any of it lands on every page-making surface at once. Re-implementing any of
//             it here is how the three mode routes came to differ in the first place.
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import { MEECHIE_TOOL_QUOTA_COST } from '$lib/core/ai-quota';
import {
	buildToolPageRecipe,
	buildToolStudioText
} from '$lib/core/tool-page-recipe';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../../contracts/meechie-tool.contract';
import type {
	MeechieToolInput,
	MeechieToolOutput
} from '../../../contracts/meechie-tool.contract';
import {
	classifyGenerationFailure,
	VERDICT_SUBJECT,
	type GenerationFailure
} from '$lib/core/generation-failure';
import { DEFAULT_PAGE_LOOK, type PageLookSelection } from '$lib/core/page-style';
import { PageArtifactState } from './page-artifact-state.svelte';
import type { PageArtifactStateOptions } from './page-artifact-state.svelte';

export type VerdictPageStateOptions = PageArtifactStateOptions;

/**
 * The verdict-to-page studio behind the standalone mode routes.
 *
 * There are deliberately **two** tokens, because the two lifecycles are cancelled by different
 * actions. `verdictToken` invalidates an in-flight `/api/tools` call and is bumped only by
 * `reset()`. `pageToken`, on `PageArtifactState`, invalidates in-flight generation, packaging and
 * vault writes, and is bumped by anything that makes the displayed page wrong — including editing
 * the dedication. A single shared token conflates them: typing in the dedication field, which is on
 * screen while a replacement verdict is still loading, would silently cancel that verdict request
 * and re-enable the button with nothing on the way.
 */
export class VerdictPageState extends PageArtifactState {
	// --- The verdict itself ---
	verdict = $state<MeechieToolOutput | null>(null);
	/**
	 * The last failed verdict request, classified.
	 *
	 * The verdict half needs this as much as the page half did, and on the same screen: a mode route
	 * shows both, so a reader whose connection dropped used to see the app's own worded sentence
	 * under one button and `Failed to fetch` under the other.
	 *
	 * An input that fails validation before anything is sent is classified here too, as a
	 * `request_rejected`. That is not a stretched fit — it is exactly the cause's meaning, and it
	 * gets the behaviour it should: a sentence, and no retry control, because pressing one against an
	 * unchanged input buys the identical refusal.
	 */
	verdictFailure = $state<GenerationFailure | null>(null);
	/**
	 * The reader-facing sentence for the last verdict failure. Derived, so there is one writer.
	 *
	 * Read by the tests rather than by a surface: the notice takes the whole failure, since it needs
	 * the retry advice as well as the words.
	 */
	error = $derived(this.verdictFailure?.message ?? '');
	isWorking = $state(false);

	// --- Page controls that belong to the verdict, not to the page ---
	dedication = $state('');
	copyStatus = $state('');

	/**
	 * The reader's choice of lettering size and room to colour, `null` per field for the page's own.
	 *
	 * Deliberately survives a new verdict. A reader who has said they want large lettering has said
	 * it about their eyes, not about one particular ruling, and re-asking a question is not a reason
	 * to put it back. `dedication` is cleared with the verdict for the opposite reason: it names a
	 * person for *this* page.
	 */
	pageLook = $state<PageLookSelection>({ ...DEFAULT_PAGE_LOOK });

	/**
	 * What the two look fields will actually be on the page this verdict makes, or `null` when there
	 * is no verdict to make a page from.
	 *
	 * Read off the recipe rather than recomputed, so the control cannot state one thing while
	 * `makePage` builds another — the recipe's own answer differs per tool and between a quote page
	 * and a list page, and a second implementation here would be the copy that drifts. `dedication`
	 * is left out of this call on purpose: it changes the page but not these two fields, and
	 * including it would rebuild the recipe on every keystroke in that box.
	 *
	 * `null` rather than a fallback pair of values: with no verdict there is no page, and inventing
	 * numbers to describe one is exactly the false provenance this control has to avoid. Every host
	 * renders the studio only once a verdict exists, so the null branch is unreachable from the
	 * shipped routes and is here to keep this total.
	 */
	effectivePageLook = $derived.by(() => {
		if (!this.verdict) return null;
		const { textSize, whitespaceScale } = buildToolPageRecipe(this.verdict, {
			look: this.pageLook
		}).spec;
		return { textSize, whitespaceScale };
	});

	/** Record the reader's look choice. The next page built takes it; the one on screen keeps its own. */
	setPageLook(next: PageLookSelection): void {
		this.pageLook = next;
	}

	private verdictToken = 0;
	/**
	 * The input of the most recent verdict ATTEMPT, so a retry re-asks the same question.
	 *
	 * Set only for inputs that actually passed validation and were sent. An input that never left
	 * the browser has nothing to retry — the reader has to change it, which is what its
	 * `change_request` advice already says.
	 */
	private lastVerdictInput: MeechieToolInput | null = null;

	/**
	 * Cleared with the page: a "Verdict copied." line under a verdict that is no longer there.
	 *
	 * The verdict a finished page was built from is not kept as a second field. Everything the page
	 * still needs from it — the words to store, the line to send with a shared picture — is pinned
	 * into the `PageSource` handed to `generatePage`, so there is nothing left to drift out of step
	 * with the live `verdict`.
	 */
	protected override clearSourceStatus(): void {
		this.copyStatus = '';
	}

	/**
	 * The server will refuse the next verdict, and has not yet said otherwise.
	 *
	 * The text-bucket twin of the inherited `pageQuotaExhausted`. Two buckets, two gates: this one
	 * stops the "ask her" control, that one stops "make the page", and a single gate would disable
	 * whichever button the *other* bucket ran out for. Priced at `MEECHIE_TOOL_QUOTA_COST`, which is
	 * what `/api/tools` actually charges — not at the studio's two-unit rewrite cost.
	 */
	get verdictQuotaExhausted(): boolean {
		return this.quota.textExhausted(MEECHIE_TOOL_QUOTA_COST);
	}

	/** Clear the verdict and everything built from it, cancelling both lifecycles. */
	reset(): void {
		this.verdictToken += 1;
		this.isWorking = false;
		this.verdictFailure = null;
		this.lastVerdictInput = null;
		this.verdict = null;
		this.dedication = '';
		this.resetPage();
	}

	/**
	 * The dedication is baked into the spec at generation time, so editing it after a page exists
	 * leaves a page, a download and a vault record carrying the old value while the field shows the
	 * new one. Drop the page instead, so the only thing on offer matches what is typed.
	 *
	 * `isGenerating` matters as much as an installed page: while `/api/generate` is pending there is
	 * no recipe and no preview yet, so checking only those would return without bumping the token,
	 * and the in-flight page — built with the previous dedication — would land beneath the new one.
	 *
	 * `driftReported` is the same argument one step further out, and the reason the first three flags
	 * are not enough on their own. A request whose image could not be decoded installs no page and
	 * leaves nothing generating, but it does leave its own findings on screen — so all three read
	 * false while a report describing the previous prompt is still rendered. Returning early there
	 * left that report sitting under a dedication it was never checked against. Diagnostics that
	 * belong to a request rather than to a page have to be cleared when the request changes.
	 */
	setDedication(value: string): void {
		this.dedication = value;
		if (
			!this.isGenerating &&
			!this.hasPage &&
			this.imagePreviews.length === 0 &&
			!this.driftReported
		)
			return;
		this.resetPage();
	}

	/**
	 * Ask a Meechie tool for a verdict.
	 *
	 * Nothing on screen is cleared up front. A verdict and the page it produced cost the user a paid
	 * generation, and wiping them before the replacement arrives means an empty field, a timeout, a
	 * provider error or an off-contract response silently destroys work that was still perfectly
	 * good, with nothing to restore it from.
	 *
	 * **Returns the verdict this call installed, or null** if it failed, was refused, or was
	 * abandoned by a reset. Callers need that answer and cannot compute it: comparing
	 * `verdict` before and after only proves *something* changed, not that *this* request changed
	 * it. An abandoned request whose replacement has already landed sees exactly the same
	 * "before !== after" as a successful one, and a route relabelling its UI on that basis
	 * attributes the new verdict to the old input.
	 */
	async requestVerdict(
		input: MeechieToolInput
	): Promise<MeechieToolOutput | null> {
		// `isGenerating` blocks this for the same reason `isWorking` blocks `makePage`: a successful
		// replacement calls `resetPage()`, which discards a generation the user has already been
		// billed for. The two guards are one rule pointing in opposite directions — never start work
		// whose only possible effect is to throw away work already paid for.
		if (this.isWorking || this.isGenerating) return null;
		// The server has already said it will refuse this verdict. The line beside the button says
		// so; letting the click through would contradict it. Priced at what `/api/tools` charges,
		// not at the studio's rewrite cost.
		if (this.verdictQuotaExhausted) return null;
		this.verdictFailure = null;
		const parsedInput = MeechieToolInputSchema.safeParse(input);
		if (!parsedInput.success) {
			this.verdictFailure = this.classifyVerdictFailure({
				rejected: 'Please complete the required fields before asking Meechie.'
			});
			return null;
		}
		this.isWorking = true;
		// Recorded before the request, so a retry re-asks this question rather than whatever is in
		// the form by the time the failure lands.
		this.lastVerdictInput = parsedInput.data;

		// Claim a fresh token so any earlier in-flight call is stale from here on.
		this.verdictToken += 1;
		const token = this.verdictToken;
		const isStale = (): boolean => token !== this.verdictToken;
		// Recorded rather than recomputed in `finally`: an abandoned request must not clear the flag
		// the newer request is holding, and `reset()` released it already.
		let abandoned = false;
		const requestedAtMs = this.clock.now();

		try {
			const payload = await postJson('/api/tools', parsedInput.data, {
				timeoutMs: POST_JSON_TIMEOUTS_MS.tools,
				// `/api/tools` spends the TEXT bucket; the generate call this class inherits spends
				// the IMAGE one. Both readings land in the same meter, in their own slots, because a
				// mode route spends both and a reader deserves to be told which one ran out.
				// Unguarded by `isStale()` for the same reason as in `PageArtifactState`: the server
				// charged this caller's bucket whatever the reader did next.
				onResponseHeaders: (headers) =>
					this.quota.record(headers, requestedAtMs, 'text')
			});
			if (isStale()) {
				abandoned = true;
				return null;
			}
			const parsed = MeechieToolResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.verdictFailure = this.classifyVerdictFailure({ offContract: true });
				return null;
			}
			if (!parsed.data.ok) {
				this.verdictFailure = this.classifyVerdictFailure({
					apiError: parsed.data.error
				});
				return null;
			}
			// Here, and only here, does what is on screen stop belonging to what is on screen.
			this.resetPage();
			this.verdict = parsed.data.value;
			return this.verdict;
		} catch (requestError) {
			if (isStale()) {
				abandoned = true;
				return null;
			}
			this.verdictFailure = this.classifyVerdictFailure({ thrown: requestError });
			return null;
		} finally {
			if (!abandoned) this.isWorking = false;
		}
	}

	/**
	 * Classify one failed verdict request, with the context only this state holds.
	 *
	 * The TEXT bucket's reset instant, not the image one the page half uses. A verdict refused for
	 * quota refills on the text window, and naming the image window's instant beside it would be the
	 * same bucket mix-up `AiQuotaLedger` was built to make unrepresentable, one control over.
	 */
	private classifyVerdictFailure(
		input: Pick<
			Parameters<typeof classifyGenerationFailure>[0],
			'thrown' | 'apiError' | 'offContract' | 'rejected'
		>
	): GenerationFailure {
		return classifyGenerationFailure({
			...input,
			subject: VERDICT_SUBJECT,
			// A verdict failure never keeps a page: it is about the words, not the paper, and the
			// paper is untouched either way. Saying "the page on screen was kept" here would answer a
			// question nobody asked about a thing that was never at risk.
			pageKept: false,
			quotaResetAtMs: this.quota.text?.resetAtMs ?? null,
			isOnline: this.readConnection()
		});
	}

	/**
	 * Ask Meechie the same question again.
	 *
	 * Re-sends `lastVerdictInput`, so a retry cannot quietly ask a different question than the one
	 * that failed — the form is editable while the request is in flight and while the failure is on
	 * screen, which is exactly the window where reading it live would go wrong.
	 */
	async retryVerdict(): Promise<MeechieToolOutput | null> {
		const input = this.lastVerdictInput;
		if (!input || this.isWorking || this.isGenerating) return null;
		return await this.requestVerdict(input);
	}

	/** Build the coloring page this verdict deserves, and package it for download. */
	async makePage(): Promise<void> {
		// `isWorking` matters as much as `isGenerating`. Keeping the previous verdict on screen while
		// a replacement loads is deliberate, but it leaves this button live for a verdict that is
		// about to be thrown away: the replacement's `resetPage()` discards whatever this produced,
		// after the generation had already been billed. Refusing to start is the only free fix.
		if (!this.verdict || this.isGenerating || this.isWorking) return;

		const verdict = this.verdict;
		const recipe = buildToolPageRecipe(verdict, {
			dedication: this.dedication,
			look: this.pageLook
		});
		await this.generatePage({
			recipe,
			// `?? undefined` at the record, not a cast here: `buildToolStudioText` returns null when
			// the verdict has no printable words to build a contract-valid record from, and the
			// vault write omits the field rather than losing the page.
			studioText: buildToolStudioText(verdict, recipe),
			headline: verdict.headline
		});
	}

	/** Put the verdict on the clipboard, headline and all. */
	async copyVerdict(): Promise<void> {
		if (!this.verdict) return;
		// A permission prompt can hold this open long enough for the user to move on. Reporting
		// "Verdict copied." under a newer verdict would invite them to paste the previous one.
		const verdict = this.verdict;
		const token = this.pageToken;
		try {
			await navigator.clipboard.writeText(
				`${verdict.headline}\n\n${verdict.response}`
			);
			if (token !== this.pageToken || this.verdict !== verdict) return;
			this.copyStatus = 'Verdict copied.';
		} catch {
			if (token !== this.pageToken || this.verdict !== verdict) return;
			this.copyStatus = 'Copy unavailable in this browser.';
		}
	}
}
