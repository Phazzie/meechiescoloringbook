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
	error = $state('');
	isWorking = $state(false);

	// --- Page controls that belong to the verdict, not to the page ---
	dedication = $state('');
	copyStatus = $state('');

	private verdictToken = 0;

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

	/** Clear the verdict and everything built from it, cancelling both lifecycles. */
	reset(): void {
		this.verdictToken += 1;
		this.isWorking = false;
		this.error = '';
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
		this.error = '';
		const parsedInput = MeechieToolInputSchema.safeParse(input);
		if (!parsedInput.success) {
			this.error = 'Please complete the required fields before asking Meechie.';
			return null;
		}
		this.isWorking = true;

		// Claim a fresh token so any earlier in-flight call is stale from here on.
		this.verdictToken += 1;
		const token = this.verdictToken;
		const isStale = (): boolean => token !== this.verdictToken;
		// Recorded rather than recomputed in `finally`: an abandoned request must not clear the flag
		// the newer request is holding, and `reset()` released it already.
		let abandoned = false;

		try {
			const payload = await postJson('/api/tools', parsedInput.data, {
				timeoutMs: POST_JSON_TIMEOUTS_MS.tools
			});
			if (isStale()) {
				abandoned = true;
				return null;
			}
			const parsed = MeechieToolResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.error = 'Tool response did not match contract.';
				return null;
			}
			if (!parsed.data.ok) {
				this.error = parsed.data.error.message;
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
			this.error =
				requestError instanceof Error
					? requestError.message
					: 'Network error. Try again.';
			return null;
		} finally {
			if (!abandoned) this.isWorking = false;
		}
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
			dedication: this.dedication
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
