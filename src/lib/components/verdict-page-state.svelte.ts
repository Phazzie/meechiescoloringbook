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
import { clockSeam } from '$lib/adapters/clock-seam';
import type { ClockSeam } from '$lib/seams/clock-seam/contract';
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

/**
 * Whether the browser can actually decode this preview.
 *
 * A byte-signature check is not enough: a truncated response keeps a valid PNG header while the
 * image itself is missing, and both `<img>` and pdf-lib reject it. Decoding is the only answer to
 * "can this be shown and printed?" that is not a proxy for it. Outside a browser there is nothing
 * to decode with, so this does not block there.
 *
 * Shared in shape with `MeechieTools.svelte`, deliberately: the two flows should reject the same
 * bytes for the same reason.
 */
const canDecodeImage = async (url: string | null): Promise<boolean> => {
	if (url === null) return false;
	if (typeof Image === 'undefined') return true;
	return await new Promise<boolean>((resolve) => {
		const probe = new Image();
		probe.onload = (): void =>
			resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
		probe.onerror = (): void => resolve(false);
		probe.src = url;
	});
};

/** One image, its preview URL, and whether the browser could actually decode it. */
type DecodedImage = {
	image: GeneratedImage;
	preview: string | null;
};

/**
 * Keep only the images the browser can decode.
 *
 * `GeneratedImageSchema` constrains `data` only to be non-empty, and the generation pipeline labels
 * unrecognised bytes as PNG, so a truncated or corrupt response passes the contract intact.
 * Installing it unchecked — and the install happens before packaging — would put a broken preview
 * on screen and arm Save to persist bytes nothing can read.
 */
const decodableImages = async (
	images: readonly GeneratedImage[]
): Promise<DecodedImage[]> => {
	const decoded = await Promise.all(
		images.map(async (image) => {
			// Built once: the decode probe and the preview must be the same URL, or a later edit can
			// let them drift apart.
			const preview = generatedImageDataUrl(image);
			return { image, preview, usable: await canDecodeImage(preview) };
		})
	);
	return decoded
		.filter((entry) => entry.usable)
		.map(({ image, preview }) => ({ image, preview }));
};

/** What one packaging variant produced, or why it produced nothing. */
type PackagedVariant = { files: PackagedFile[]; error: string | null };

/**
 * Package one variant, turning every failure shape into a value.
 *
 * The adapter does not wrap every failure in a `Result`: `package()` has no try/catch, and
 * pdf-lib's `embedPng`/`embedJpg`/`save` and the canvas in `imageToPngBase64` all throw. A
 * rejection used to escape to the caller's outer catch and discard the print PDF that had already
 * been built — so splitting print and square into two calls bought nothing against the failure
 * shape most likely to occur.
 */
const packageOneVariant = async (
	variant: 'print' | 'square',
	images: GeneratedImage[],
	fileBaseName: string,
	pageSize: ToolPageRecipe['spec']['pageSize']
): Promise<PackagedVariant> => {
	try {
		const result = await outputPackagingAdapter.package({
			images,
			outputFormat: 'pdf',
			fileBaseName,
			pageSize,
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

/**
 * A record id that cannot collide with another save.
 *
 * `crypto.randomUUID` is gated on a secure context, so it is simply absent over plain HTTP and in
 * some embedded webviews. The previous fallback was `creation-${Date.now()}`, and
 * `upsertRecord` in `creation-store.adapter.ts` drops any existing record sharing an id — so two
 * saves landing in the same millisecond (two tabs on one vault) silently destroyed the first.
 *
 * `crypto.getRandomValues` is *not* secure-context gated, so it covers almost everything
 * `randomUUID` misses. The last resort matches `session.adapter.ts`'s existing fallback, which
 * mixes the clock with a random suffix rather than trusting the millisecond alone.
 */
let fallbackCounter = 0;

/**
 * A value that differs between two documents of the same origin, without a PRNG.
 *
 * `performance.timeOrigin` is the instant *this document* started, at sub-millisecond resolution,
 * so two tabs almost never share one. It exists only to separate tabs in the last-resort id below;
 * it is not a secret and nothing depends on it being unguessable.
 */
const documentToken = ((): string => {
	if (typeof performance === 'undefined') return '0';
	const origin =
		typeof performance.timeOrigin === 'number' ? performance.timeOrigin : 0;
	return Math.trunc((origin + performance.now()) * 1000).toString(36);
})();

const newCreationId = (): string => {
	if (typeof crypto !== 'undefined') {
		if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
		if (typeof crypto.getRandomValues === 'function') {
			const bytes = crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte) =>
				byte.toString(16).padStart(2, '0')
			).join('');
			return `creation-${hex}`;
		}
	}
	// Last resort, and deliberately not `Math.random()`: reaching for a pseudorandom source when a
	// cryptographic one sits right above it is the habit SonarCloud's PRNG rule exists to break.
	//
	// Uniqueness here needs two separate things, because the two collisions are different. The
	// counter separates saves *within* one document, which is what `Date.now()` alone could not do.
	// `documentToken` separates *documents*, which the counter alone could not do — two tabs each
	// start their own counter at zero, so both would otherwise emit `-1` in the same millisecond.
	//
	// This is a bound, not a proof: two documents whose `timeOrigin` matches to the microsecond,
	// saving in the same millisecond, would still collide. Reaching this branch at all requires a
	// browser with no Web Crypto whatsoever — `getRandomValues`, unlike `randomUUID`, is not
	// secure-context gated — which no browser able to run this app has been for over a decade.
	fallbackCounter += 1;
	return `creation-${Date.now()}-${documentToken}-${fallbackCounter}`;
};

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
	/**
	 * The clock behind a saved page's `createdAtISO`. Injectable for the same reason `StudioState`
	 * injects one: a test should be able to state the instant rather than observe it.
	 */
	clock: ClockSeam = clockSeam;
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
		// Advance the token without clearing anything. Any earlier in-flight run is stale from here,
		// but the page already on screen stays: it cost a paid generation, and until a replacement
		// has actually arrived it is the best thing this class has. Calling `resetPage()` here meant
		// a timeout, a provider error, an off-contract response or an undecodable image deleted a
		// good page and left the reader with nothing — the same defect as the verdict path, on the
		// page path.
		this.pageToken += 1;
		this.generateError = '';
		this.vaultStatus = '';
		this.copyStatus = '';
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

			const usable = await decodableImages(parsed.data.value.images);
			if (isStale()) return;
			if (usable.length === 0) {
				// Keep whatever is already on screen. It cost a paid generation, and an unreadable
				// replacement is not a reason to destroy it.
				this.generateError =
					'The provider returned an image that could not be read. The page on screen was kept.';
				return;
			}
			const images = usable.map((entry) => entry.image);

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
			this.imagePreviews = usable
				.map((entry) => entry.preview)
				.filter((url): url is string => url !== null);
			this.packagedFiles = [];

			await this.attachDownloads(images, recipe.spec.pageSize, token);
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

	/**
	 * Build the downloads for the page that is already installed, and report what could not be built.
	 *
	 * Separate from `makePage` because it is a distinct phase with its own failure rules: the page
	 * exists and stays whatever happens here, so nothing in this method may clear it. Splitting it
	 * out also keeps `makePage` readable as ask / validate / keep what decodes / install / package.
	 */
	private async attachDownloads(
		images: GeneratedImage[],
		pageSize: ToolPageRecipe['spec']['pageSize'],
		token: number
	): Promise<void> {
		const isStale = (): boolean => token !== this.pageToken;
		const fileBaseName = `meechie-${this.fileBaseSlug}-${Date.now()}`;
		const print = await packageOneVariant(
			'print',
			images,
			fileBaseName,
			pageSize
		);
		// Checked here, not only after both: the square variant rasterises a 1080px canvas, and
		// starting that for a page the user has already replaced burns time and memory on a result
		// that is guaranteed to be discarded.
		if (isStale()) return;
		const share = await packageOneVariant(
			'square',
			images,
			fileBaseName,
			pageSize
		);
		if (isStale()) return;

		this.packagedFiles = [...print.files, ...share.files];
		if (print.error !== null) {
			this.generateError = `Page made, but the printable download could not be built: ${print.error}`;
		} else if (share.error !== null) {
			this.generateError = `Page and PDF are ready; the square share image could not be built: ${share.error}`;
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
					id: newCreationId(),
					// Through `ClockSeam`, not `new Date()`: `AGENTS.md` classifies clock/time as a
					// seam, and the seam's own contract says anything needing "now" must cross it so
					// the behaviour is drivable from a test rather than dependent on when the suite
					// happens to run. The adapter already exists; consuming it changes no contract.
					createdAtISO: new Date(this.clock.now()).toISOString(),
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
