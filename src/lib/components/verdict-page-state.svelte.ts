// Purpose: Own the whole "Meechie ruled on it -> here is your coloring page" lifecycle for the
//          standalone mode routes, as one testable state class.
// Why: `/who-fucked-up`, `/rate-his-excuse` and `/random` are three of the app's four nav
//      destinations, and each carried its own ~90-line copy of this flow. All three copies
//      flattened every verdict into a title-only page, threw the drift report away, could not
//      save anything to the vault, and packaged the print and share files in one call so a
//      browser that could not encode the share image lost the printable PDF with it. Fixing that
//      once, here, is the only way it stays fixed.
// Info flow: tool input -> /api/tools -> verdict -> buildToolPageRecipe -> /api/generate ->
//            previews + packaged files -> CreationStoreSeam.
import { creationStoreAdapter } from '$lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '$lib/adapters/session.adapter';
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import {
	generatedImageBase64,
	generatedImageDataUrl
} from '$lib/core/generated-image-preview';
import {
	buildToolPageRecipe,
	buildToolStudioText
} from '$lib/core/tool-page-recipe';
import type { ToolPageRecipe } from '$lib/core/tool-page-recipe';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../../contracts/meechie-tool.contract';
import type {
	MeechieToolInput,
	MeechieToolOutput
} from '../../../contracts/meechie-tool.contract';
import { GenerateResultSchema } from '../../../contracts/generate.contract';
import type { GenerateResponseValue } from '../../../contracts/generate.contract';
import type { CreationOwner } from '../../../contracts/creation-store.contract';
import type { GeneratedImage } from '../../../contracts/image-generation.contract';
import type { PackagedFile } from '../../../contracts/output-packaging.contract';

export type VerdictPageStateOptions = {
	/**
	 * Slug for the downloaded filenames, e.g. `who-fucked-up` produces
	 * `meechie-who-fucked-up-<timestamp>.pdf`. The route owns this because the filename is the only
	 * part of a download the user sees before opening it.
	 */
	fileBaseSlug: string;
};

/**
 * The verdict-to-page studio behind the standalone mode routes.
 *
 * Every asynchronous method re-checks its token after each await. That is not defensive padding:
 * `/api/generate` routinely runs long enough for a user to ask for a different situation or
 * another saying, and a response that installs itself after that lands a page built from verdict A
 * underneath verdict B on screen — which the user then downloads, or saves to the vault, believing
 * it is the page for what they are reading.
 *
 * There are deliberately **two** tokens, because the two lifecycles are cancelled by different
 * actions. `verdictToken` invalidates an in-flight `/api/tools` call and is bumped only by
 * `reset()`. `pageToken` invalidates in-flight generation, packaging and vault writes, and is
 * bumped by anything that makes the displayed page wrong — including editing the dedication. A
 * single shared token conflates them: typing in the dedication field, which is on screen while a
 * replacement verdict is still loading, would silently cancel that verdict request and re-enable
 * the button with nothing on the way.
 */
export class VerdictPageState {
	// --- The verdict itself ---
	verdict = $state<MeechieToolOutput | null>(null);
	error = $state('');
	isWorking = $state(false);

	// --- The page that verdict became ---
	isGenerating = $state(false);
	generateError = $state('');
	imagePreviews = $state<string[]>([]);
	packagedFiles = $state<PackagedFile[]>([]);
	assembledPrompt = $state('');
	revisedPrompt = $state('');
	/**
	 * Drift diagnostics from `/api/generate`. The provider's revised prompt can quietly drop an
	 * exact-text or layout requirement; all three routes used to discard these, which presents a
	 * drifted page as a clean one and loses the evidence for good.
	 */
	violations = $state<GenerateResponseValue['violations']>([]);
	recommendedFixes = $state<GenerateResponseValue['recommendedFixes']>([]);

	// --- Page controls ---
	dedication = $state('');
	vaultStatus = $state('');
	copyStatus = $state('');
	isSaving = $state(false);

	private generatedImages: GeneratedImage[] = [];
	private lastRecipe: ToolPageRecipe | null = null;
	/**
	 * The verdict the page on screen was built from. Kept apart from `verdict`, which changes the
	 * instant a replacement arrives.
	 */
	private pageVerdict: MeechieToolOutput | null = null;
	private verdictToken = 0;
	private pageToken = 0;
	private owner: CreationOwner | null = null;
	/** In-flight session resolve, so concurrent saves share one call rather than racing. */
	private ownerPromise: Promise<CreationOwner | null> | null = null;
	private readonly fileBaseSlug: string;

	constructor(options: VerdictPageStateOptions) {
		this.fileBaseSlug = options.fileBaseSlug;
	}

	/** True once there is a generated page to download or save. */
	get hasPage(): boolean {
		return this.generatedImages.length > 0 && this.lastRecipe !== null;
	}

	/** True when a save would actually be attempted, so the button can explain itself instead. */
	get canSaveToVault(): boolean {
		return this.hasPage && !this.isSaving;
	}

	/**
	 * Resolve the session id an owner-scoped vault write needs, on demand.
	 *
	 * Deliberately *not* started from the constructor. A constructor cannot report an async failure
	 * to whoever called `new`, so an eager fire-and-forget load could only either swallow the error
	 * or surface it as an unhandled rejection — and it bought nothing, because the answer is not
	 * needed until someone presses Save. Resolving here also means a session that was unavailable
	 * on the first attempt (a browser that had site data blocked, and then did not) is retried on
	 * the next save instead of being wrong for the life of the page.
	 *
	 * The in-flight promise is shared so two quick saves make one call, and it is cleared on failure
	 * so a failed resolve is never cached as the permanent answer.
	 */
	private async resolveOwner(): Promise<CreationOwner | null> {
		if (this.owner) return this.owner;
		this.ownerPromise ??= (async (): Promise<CreationOwner | null> => {
			try {
				const result = await sessionAdapter.getSession();
				return result.ok
					? { kind: 'anonymous', sessionId: result.value.sessionId }
					: null;
			} catch {
				// A *thrown* session read is the same outcome as a failed one, and it has to reach the
				// same branch below. `localStorage` exists but throws `SecurityError` on access in a
				// browser with site data blocked, so this path is reachable in practice — and letting
				// the rejection escape would leave the memo holding a permanently rejected promise,
				// which every later save would re-await and re-throw. That is exactly the "never cache
				// a failure" rule this function exists to keep, so it must cover both shapes of it.
				return null;
			}
		})();
		const owner = await this.ownerPromise;
		if (owner) {
			this.owner = owner;
		} else {
			this.ownerPromise = null;
		}
		return owner;
	}

	/**
	 * Drop the generated page and cancel anything still building or saving one.
	 *
	 * Bumping `pageToken` is the cancellation: an in-flight request cannot be recalled, but its
	 * result is discarded on arrival instead of landing under a newer verdict. `isGenerating` is
	 * released here because the staleness guards deliberately stop an abandoned request from
	 * clearing a *newer* request's flag — so the abandoned request clears nothing, and the reset has
	 * to. Without this, resetting mid-generation left the button disabled until a reload.
	 *
	 * `isWorking` is untouched on purpose; the verdict request has its own token and its own reset.
	 */
	resetPage(): void {
		this.pageToken += 1;
		this.isGenerating = false;
		this.generateError = '';
		this.imagePreviews = [];
		this.packagedFiles = [];
		this.assembledPrompt = '';
		this.revisedPrompt = '';
		this.violations = [];
		this.recommendedFixes = [];
		this.vaultStatus = '';
		this.copyStatus = '';
		this.generatedImages = [];
		this.lastRecipe = null;
		this.pageVerdict = null;
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
	 */
	setDedication(value: string): void {
		this.dedication = value;
		if (!this.isGenerating && !this.hasPage && this.imagePreviews.length === 0)
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
		if (this.isWorking) return null;
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
		// `resetPage` first: it bumps the token, so this run claims the value it leaves behind and
		// any earlier in-flight run is already stale by the time this one starts.
		this.resetPage();
		this.isGenerating = true;

		const verdict = this.verdict;
		const token = this.pageToken;
		const isStale = (): boolean => token !== this.pageToken;
		const recipe = buildToolPageRecipe(verdict, {
			dedication: this.dedication
		});

		try {
			const payload = await postJson(
				'/api/generate',
				{ spec: recipe.spec, styleHint: recipe.styleHint },
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.generate }
			);
			if (isStale()) return;
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.generateError = 'Generate response did not match contract.';
				return;
			}
			if (!parsed.data.ok) {
				this.generateError = parsed.data.error.message;
				return;
			}

			const images = parsed.data.value.images;

			// Install the page *before* packaging it. The generation is the paid part and it has
			// already succeeded here; packaging is a local render that can fail on its own. Leaving
			// the install until afterwards meant any packaging problem skipped it entirely and threw
			// the whole page away — the images included.
			this.pageVerdict = verdict;
			this.lastRecipe = recipe;
			this.generatedImages = images;
			this.assembledPrompt = parsed.data.value.prompt;
			this.revisedPrompt = parsed.data.value.revisedPrompt ?? '';
			this.violations = parsed.data.value.violations;
			this.recommendedFixes = parsed.data.value.recommendedFixes;
			this.imagePreviews = images
				.map(generatedImageDataUrl)
				.filter((url): url is string => url !== null);
			this.packagedFiles = [];

			// Two packaging calls, not one with `variants: ['print', 'square']`. The adapter builds
			// the print file first and then returns the square failure *without* its accumulated
			// files, so a browser that cannot encode the 1080px share canvas took the printable PDF
			// down with it. The PDF is the product; the square image is a nicety.
			//
			// Each call is caught on its own, because the adapter does not wrap every failure in a
			// `Result`: `package()` has no try/catch, and pdf-lib's `embedPng`/`embedJpg`/`save` and
			// the canvas in `imageToPngBase64` all throw. A rejection from the square call escaped to
			// the outer catch and discarded the print PDF that had already been built — so splitting
			// the calls bought nothing against the failure shape most likely to occur.
			const fileBaseName = `meechie-${this.fileBaseSlug}-${Date.now()}`;
			const packageVariant = async (
				variant: 'print' | 'square'
			): Promise<{ files: PackagedFile[]; error: string | null }> => {
				try {
					const result = await outputPackagingAdapter.package({
						images,
						outputFormat: 'pdf',
						fileBaseName,
						pageSize: recipe.spec.pageSize,
						variants: [variant]
					});
					return result.ok
						? { files: result.value.files, error: null }
						: { files: [], error: result.error.message };
				} catch (packagingError) {
					return {
						files: [],
						error:
							packagingError instanceof Error
								? packagingError.message
								: 'Packaging failed.'
					};
				}
			};
			const print = await packageVariant('print');
			const share = await packageVariant('square');
			if (isStale()) return;

			this.packagedFiles = [...print.files, ...share.files];
			if (print.error !== null) {
				this.generateError = `Page made, but the printable download could not be built: ${print.error}`;
			} else if (share.error !== null) {
				this.generateError = `Page and PDF are ready; the square share image could not be built: ${share.error}`;
			}
		} catch (requestError) {
			if (isStale()) return;
			this.generateError =
				requestError instanceof Error
					? requestError.message
					: 'Network error. Try again.';
		} finally {
			if (!isStale()) this.isGenerating = false;
		}
	}

	/** Keep the page: write it into the same owner-scoped vault the studio saves to. */
	async saveToVault(): Promise<void> {
		if (this.isSaving || !this.lastRecipe || !this.pageVerdict) return;
		if (this.generatedImages.length === 0) return;
		// Pinned before any await for the same reason the generation path pins its verdict: these
		// fields are cleared by `resetPage()`, and the record must describe the page that was on
		// screen when the button was pressed.
		const recipe = this.lastRecipe;
		const pageVerdict = this.pageVerdict;
		const images = this.generatedImages;
		const assembledPrompt = this.assembledPrompt;
		const revisedPrompt = this.revisedPrompt;
		const violations = this.violations;
		this.isSaving = true;
		this.vaultStatus = 'Saving...';
		const token = this.pageToken;
		try {
			const owner = await this.resolveOwner();
			if (token !== this.pageToken) return;
			if (!owner) {
				// Not "still connecting": the session genuinely could not be opened, and the usual
				// cause is a browser blocking site data. Saying so is actionable; inviting a retry
				// against a condition that will not change on its own is not.
				this.vaultStatus =
					'Could not open your session, so there is nowhere to save this page. Check that your browser allows site data for this site.';
				return;
			}
			const result = await creationStoreAdapter.saveCreation({
				record: {
					id:
						typeof crypto !== 'undefined' &&
						typeof crypto.randomUUID === 'function'
							? crypto.randomUUID()
							: `creation-${Date.now()}`,
					createdAtISO: new Date().toISOString(),
					intent: recipe.spec,
					assembledPrompt,
					revisedPrompt: revisedPrompt || undefined,
					// Store the verdict's own text. Leaving this unset is not neutral: the reopen path
					// falls back to `assembledPrompt` for the quote, which on a generated page is the
					// image-generation prompt, and to the default landlord page items when the saved
					// spec has none. `?? undefined`, not a cast: `buildToolStudioText` returns null
					// when the verdict has no printable words to build a contract-valid record from,
					// and omitting the field keeps the save valid rather than losing the page.
					studioText: buildToolStudioText(pageVerdict, recipe) ?? undefined,
					violations,
					// `fixesApplied` is deliberately omitted, not filled from `recommendedFixes`.
					// This flow never applies a recommendation and never regenerates with one, so
					// writing them into a field named "applied" records a correction that did not
					// happen — and a later reader could not tell a drifted page from a corrected
					// one. `violations` above still carries the full drift evidence, which is the
					// part that is actually true. The two older call sites
					// (`studio-state.svelte.ts`, `MeechieTools.svelte`) still write recommendations
					// here; that is a pre-existing defect in persisted-record semantics and fixing
					// it belongs in its own change, not smuggled into this one.
					images: images.map((image) => ({ b64: generatedImageBase64(image) })),
					owner
				}
			});
			if (token !== this.pageToken) return;
			this.vaultStatus = result.ok
				? 'Saved to the vault. Find it on the home page.'
				: result.error.message;
		} catch (saveError) {
			if (token !== this.pageToken) return;
			this.vaultStatus =
				saveError instanceof Error
					? saveError.message
					: 'Failed to save to vault.';
		} finally {
			this.isSaving = false;
		}
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
