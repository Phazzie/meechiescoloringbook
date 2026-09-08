// Purpose: Own the "here is a spec — turn it into a finished, downloadable, printable, saveable
//          coloring page" half of every page-making surface, as one testable state class.
// Why: `VerdictPageState` grew this lifecycle for the three standalone mode routes, and it is the
//      only complete one in the app: it installs the page before packaging it, keeps a good page
//      when a replacement fails, splits the print and share packaging so one failure cannot take
//      the other's file with it, reports a packaging failure separately from a generation failure,
//      and writes the vault record through `ClockSeam`. All of that was reachable only by having a
//      `MeechieToolOutput` in hand. `/describe` has no verdict and needs every line of it, so the
//      half that never depended on a verdict lives here and the verdict half extends it.
// Info flow: PageSource (a recipe plus what to store and say about it) -> /api/generate ->
//            decodable previews -> installed page -> OutputPackagingSeam -> export row ->
//            CreationStoreSeam.
// Invariants:
//   - `driftReported` is independent of both `violations.length` and page presence, and must never
//     be collapsed into either: an empty violation list means "checked, nothing wrong" AND "no
//     check has spoken", which are opposite claims, and only this flag separates them.
//   - When a replacement generation returns no decodable image, the page already on screen keeps
//     BOTH its picture and its report. The new request's findings are surfaced only when there is
//     no page to protect, because attaching them to a page they do not describe is the exact
//     conflation this reporting exists to remove. Those pageless findings belong to a REQUEST, so
//     every path that changes the request must clear them — page presence cannot stand in for
//     that, since after such a request `hasPage`, `isGenerating` and `imagePreviews` all read
//     exactly as they do before the first one.
//   - Every asynchronous method re-checks `pageToken` after each await. `/api/generate` routinely
//     runs long enough for the reader to ask for something else, and a response that installs
//     itself after that puts page A underneath source B on screen — which the reader then
//     downloads, or saves to the vault, believing it is the page for what they are reading.
import { creationStoreAdapter } from '$lib/adapters/creation-store-seam';
import { outputPackagingAdapter } from '$lib/adapters/output-packaging-seam';
import { sessionAdapter } from '$lib/adapters/session-seam';
import { clockSeam } from '$lib/adapters/clock-seam';
import type { ClockSeam } from '$lib/seams/clock-seam/contract';
import { AiQuotaMeter } from './ai-quota-meter.svelte';
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import {
	generatedImageBase64,
	generatedImageDataUrl
} from '$lib/core/generated-image-preview';
import type { ToolPageRecipe } from '$lib/core/tool-page-recipe';
import { buildQualityReport } from '$lib/core/quality-report';
import {
	describeOriginalImageExport,
	describePackagedExports,
	summarisePageExportFailures
} from '$lib/core/page-exports';
import type { PageExport, PageExportAttempt } from '$lib/core/page-exports';
import { GenerateResultSchema } from '../../../contracts/generate.contract';
import type { GenerateResponseValue } from '../../../contracts/generate.contract';
import { VAULT_SAVED_CONFIRMATION } from '$lib/core/vault-page';
import type { CreationOwner } from '$lib/seams/creation-store-seam/contract';
import type { MeechieStudioTextOutput } from '../../../contracts/meechie-studio-text.contract';
import type { GeneratedImage } from '../../../contracts/image-generation.contract';
import type { PackagedFile } from '$lib/seams/output-packaging-seam/contract';

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

/**
 * Everything a finished page needs to know about where it came from.
 *
 * The one thing that differs between a page Meechie ruled into existence and a page the reader
 * described in their own words, expressed as data so the lifecycle below needs no branch for it.
 *
 * `studioText` is nullable and that nullability is load-bearing: `MeechieStudioTextOutputSchema`
 * requires a `verdict` string and between two and six `pageItems`, so a source with nothing to put
 * in those fields must store none rather than invent them. A described page writes `null` here for
 * exactly that reason — putting the reader's own sentence in a field called `verdict` would claim
 * Meechie said something she never said, and `warrantForRestoredVerdict` already exists to tell a
 * reopened page's words apart from hers.
 */
export type PageSource = {
	/** The spec and style hint this page is generated from. */
	recipe: ToolPageRecipe;
	/** Words to store with a saved page, or `null` when this flow has none it can vouch for. */
	studioText: MeechieStudioTextOutput | null;
	/** The line that travels with a shared picture, or `null` when there is none. */
	headline: string | null;
};

export type PageArtifactStateOptions = {
	/**
	 * Slug for the downloaded filenames, e.g. `who-fucked-up` produces
	 * `meechie-who-fucked-up-<timestamp>.pdf`. The surface owns this because the filename is the
	 * only part of a download the user sees before opening it.
	 */
	fileBaseSlug: string;
};

export class PageArtifactState {
	// --- The page a source became ---
	isGenerating = $state(false);
	generateError = $state('');
	imagePreviews = $state<string[]>([]);
	/**
	 * What each packaging call was asked for and what it produced.
	 *
	 * The stored record, from which the row and its failure sentence are both derived — the same
	 * arrangement the home studio has had since Run 6. Keeping the attempts rather than only their
	 * files is what lets a download name the paper it was actually packaged for, and what lets a
	 * failure be described by the variant that was *requested* rather than by a file that does not
	 * exist to read a type off.
	 */
	packageAttempts = $state<PageExportAttempt[]>([]);
	/** The bytes of every file packaged for the page on the paper. */
	packagedFiles = $derived<PackagedFile[]>(
		this.packageAttempts.flatMap((attempt) => attempt.files)
	);
	/**
	 * The provider's own image for the page on screen, kept reactive so the export row can offer it.
	 *
	 * Separate from the protected `generatedImages`, which is a plain field and therefore invisible
	 * to a `$derived`. This is the one download that involves no re-rendering at all.
	 */
	protected pageOriginalImage = $state<GeneratedImage | null>(null);
	/** The base name every download for the page on screen shares. */
	protected pageFileBaseName = $state('');
	/**
	 * The export row: each packaged file, then the provider's own image, every one of them carrying
	 * what it is, what it is for and how big it is.
	 *
	 * The original comes last and is derived rather than stored, so it appears and disappears with
	 * the page it belongs to and can never be left behind by a reset.
	 */
	pageExports = $derived.by((): PageExport[] => {
		// No page size passed: each attempt carries the one it was packaged for, so the row cannot
		// describe a file as paper it was not made on.
		const packaged = describePackagedExports(this.packageAttempts);
		const original = describeOriginalImageExport(
			this.pageOriginalImage,
			this.pageFileBaseName
		);
		return original ? [...packaged, original] : packaged;
	});
	/**
	 * What could not be packaged, phrased so it can never be read as "the generation failed".
	 *
	 * A separate field from `generateError`, which is where both used to be written — so a page that
	 * generated perfectly and then failed to become a square PNG showed the same crimson box, in the
	 * same place, as a page that never generated at all, directly above the button that buys another
	 * generation.
	 */
	exportError = $derived(summarisePageExportFailures(this.packageAttempts));
	assembledPrompt = $state('');
	revisedPrompt = $state('');
	/**
	 * Drift diagnostics from `/api/generate`. The provider's revised prompt can quietly drop an
	 * exact-text or layout requirement; a surface that discards these presents a drifted page as a
	 * clean one and loses the evidence for good.
	 */
	violations = $state<GenerateResponseValue['violations']>([]);
	recommendedFixes = $state<GenerateResponseValue['recommendedFixes']>([]);
	/**
	 * True when the drift check has reported on the page currently installed.
	 *
	 * An empty `violations` means both "checked and clean" and "never checked", and the drift block
	 * used to render the second as the first by showing nothing at all. Written only where
	 * `violations` is written — the install below and the reset above.
	 */
	protected driftReported = $state(false);
	/** Why the drift check returned no verdict, when `/api/generate` said it returned none. */
	protected driftCheckFailure =
		$state<GenerateResponseValue['driftCheckFailure']>(undefined);
	/** What the drift block says about the page currently installed. */
	qualityReport = $derived(
		buildQualityReport({
			// Page presence and check completion are separate facts; see `buildQualityReport`.
			hasPage: this.imagePreviews.length > 0,
			driftChecked: this.driftReported,
			violations: this.violations,
			recommendedFixes: this.recommendedFixes,
			driftCheckFailure: this.driftCheckFailure
		})
	);

	vaultStatus = $state('');
	isSaving = $state(false);

	protected generatedImages: GeneratedImage[] = [];
	protected lastRecipe: ToolPageRecipe | null = null;
	/**
	 * Where the page on screen came from. Kept apart from whatever *live* value a subclass holds:
	 * a replacement verdict or a fresh interpretation lands the instant it arrives, and the page
	 * must go on describing the thing it was actually built from until it is replaced too.
	 */
	protected pageSource: PageSource | null = null;
	protected pageToken = 0;
	/**
	 * The clock behind a saved page's `createdAtISO`. Injectable for the same reason `StudioState`
	 * injects one: a test should be able to state the instant rather than observe it.
	 */
	clock: ClockSeam = clockSeam;
	/**
	 * Every quota reading this surface holds, both buckets.
	 *
	 * Lives on the base class because `/api/generate` is called from here, so every subclass —
	 * `VerdictPageState` and `DescribePageState`, and through them all thirteen page-making
	 * surfaces — inherits a truthful image-bucket reading without doing anything. A subclass that
	 * also spends the text bucket records into this same meter, which is why it holds a slot per
	 * bucket rather than a single snapshot.
	 */
	readonly quota: AiQuotaMeter = new AiQuotaMeter({
		// Read through a closure, not captured: `clock` above is assignable and tests replace it
		// after construction, so the meter must follow whichever clock this state currently holds.
		clock: () => this.clock
	});
	private owner: CreationOwner | null = null;
	/** In-flight session resolve, so concurrent saves share one call rather than racing. */
	private ownerPromise: Promise<CreationOwner | null> | null = null;
	protected readonly fileBaseSlug: string;

	constructor(options: PageArtifactStateOptions) {
		this.fileBaseSlug = options.fileBaseSlug;
	}

	/** True once there is a generated page to download or save. */
	get hasPage(): boolean {
		return this.generatedImages.length > 0 && this.lastRecipe !== null;
	}

	/**
	 * The title of the page currently on the paper, or `null` before there is one.
	 *
	 * Read off `lastRecipe` — the recipe the picture was actually built from — rather than off any
	 * live value, which changes the instant a replacement arrives. The print job names the sheet
	 * coming out of the printer, so it has to name the page on screen; taking it from a live value
	 * would title a saved sheet after something that never printed. This is the same distinction
	 * `pageSource` exists to hold, and the same one the export row learned when a US Letter PDF was
	 * being labelled "A4" from a live control.
	 */
	get pageTitle(): string | null {
		return this.lastRecipe?.spec.title ?? null;
	}

	/**
	 * The line for the page on the paper, for the message that travels with a sent picture.
	 *
	 * Read off `pageSource` for the same reason `pageTitle` is read off `lastRecipe`.
	 */
	get pageHeadline(): string | null {
		return this.pageSource?.headline ?? null;
	}

	/**
	 * True when a save would actually be attempted, so the button can explain itself instead.
	 *
	 * `!isGenerating` is load-bearing since generation stopped clearing the page on entry: page A
	 * stays on screen while B generates, so without this the button is live, and a save started in
	 * that window pins A's recipe and images while capturing B's token. Installing B does not bump
	 * the token again, so the save's own staleness check passes and it reports "Saved to the vault"
	 * under B — having persisted A. Blocking the window is simpler than making that message honest,
	 * and the window is as short as one generation.
	 */
	get canSaveToVault(): boolean {
		return this.hasPage && !this.isSaving && !this.isGenerating;
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
	 * Status lines a subclass keeps *about the source* of a page, cleared alongside the page itself.
	 *
	 * A hook rather than a field here, because the base class must not own a status it never writes.
	 * Called from `resetPage`, which is never reached from this constructor — so a subclass field
	 * initialiser, which runs after the base constructor, is always in place by the time it fires.
	 */
	protected clearSourceStatus(): void {}

	/**
	 * Drop the generated page and cancel anything still building or saving one.
	 *
	 * Bumping `pageToken` is the cancellation: an in-flight request cannot be recalled, but its
	 * result is discarded on arrival instead of landing under a newer source. `isGenerating` is
	 * released here because the staleness guards deliberately stop an abandoned request from
	 * clearing a *newer* request's flag — so the abandoned request clears nothing, and the reset has
	 * to. Without this, resetting mid-generation left the button disabled until a reload.
	 */
	resetPage(): void {
		this.pageToken += 1;
		this.isGenerating = false;
		this.generateError = '';
		this.imagePreviews = [];
		this.packageAttempts = [];
		this.pageOriginalImage = null;
		this.pageFileBaseName = '';
		this.assembledPrompt = '';
		this.revisedPrompt = '';
		this.violations = [];
		this.recommendedFixes = [];
		this.driftReported = false;
		this.driftCheckFailure = undefined;
		this.vaultStatus = '';
		this.clearSourceStatus();
		this.generatedImages = [];
		this.lastRecipe = null;
		this.pageSource = null;
	}

	/**
	 * Build the coloring page a source describes, and package it for download.
	 *
	 * Callers guard on whatever *else* makes starting pointless — a verdict about to be replaced,
	 * an interpretation not yet made — and then hand the finished source here. This method guards
	 * only on the one condition it owns.
	 */
	protected async generatePage(source: PageSource): Promise<void> {
		if (this.isGenerating) return;
		// Advance the token without clearing anything. Any earlier in-flight run is stale from here,
		// but the page already on screen stays: it cost a paid generation, and until a replacement
		// has actually arrived it is the best thing this class has. Calling `resetPage()` here meant
		// a timeout, a provider error, an off-contract response or an undecodable image deleted a
		// good page and left the reader with nothing.
		this.pageToken += 1;
		this.generateError = '';
		this.vaultStatus = '';
		this.clearSourceStatus();
		this.isGenerating = true;

		const token = this.pageToken;
		const isStale = (): boolean => token !== this.pageToken;
		const recipe = source.recipe;
		// Anchored at send, not at receipt: this route routinely runs for minutes against a
		// 60-second window, so a reset instant measured from the reply would sit far in the future
		// for a bucket that had already refilled. See `AiQuotaMeter`'s invariants.
		const requestedAtMs = this.clock.now();

		try {
			const payload = await postJson(
				'/api/generate',
				{ spec: recipe.spec, styleHint: recipe.styleHint },
				{
					timeoutMs: POST_JSON_TIMEOUTS_MS.generate,
					// The single most valuable line in this change: every page-making surface in the
					// app reaches `/api/generate` through this one method, so recording the image
					// bucket here is what gives all thirteen of them a truthful meter at once. It is
					// deliberately NOT guarded by `isStale()` — the reading describes this caller's
					// bucket, which the server charged whatever the reader did next, so it stays
					// true and useful even when the page it came with is abandoned.
					onResponseHeaders: (headers) =>
						this.quota.record(headers, requestedAtMs, 'image')
				}
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
				// With no page already on screen there is nothing to protect, so the request's own
				// findings are the most useful thing the reader can be given. When a page *is* on
				// screen it keeps its own report: attaching this request's findings to a page they do
				// not describe is the conflation this whole arrangement exists to remove, so the fix
				// is conditional rather than simply hoisting the assignment above the guard.
				if (!this.hasPage) {
					this.violations = parsed.data.value.violations;
					this.recommendedFixes = parsed.data.value.recommendedFixes;
					this.driftCheckFailure = parsed.data.value.driftCheckFailure;
					this.driftReported = true;
				}
				return;
			}
			const images = usable.map((entry) => entry.image);

			// Install the page *before* packaging it. The generation is the paid part and it has
			// already succeeded here; packaging is a local render that can fail on its own. Leaving
			// the install until afterwards meant any packaging problem skipped it entirely and threw
			// the whole page away — the images included.
			this.pageSource = source;
			this.lastRecipe = recipe;
			this.generatedImages = images;
			this.assembledPrompt = parsed.data.value.prompt;
			this.revisedPrompt = parsed.data.value.revisedPrompt ?? '';
			this.violations = parsed.data.value.violations;
			this.recommendedFixes = parsed.data.value.recommendedFixes;
			this.driftReported = true;
			this.driftCheckFailure = parsed.data.value.driftCheckFailure;
			this.imagePreviews = usable
				.map((entry) => entry.preview)
				.filter((url): url is string => url !== null);
			this.packageAttempts = [];
			// The provider's own bytes are downloadable the moment the page lands; packaging takes
			// seconds. Waiting for it would hide the one file that needs no rendering at all behind
			// the two that do.
			this.pageOriginalImage = images[0] ?? null;

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
	 * Separate from `generatePage` because it is a distinct phase with its own failure rules: the
	 * page exists and stays whatever happens here, so nothing in this method may clear it. Splitting
	 * it out also keeps the generation readable as ask / validate / keep what decodes / install /
	 * package.
	 */
	private async attachDownloads(
		images: GeneratedImage[],
		pageSize: ToolPageRecipe['spec']['pageSize'],
		token: number
	): Promise<void> {
		const isStale = (): boolean => token !== this.pageToken;
		const fileBaseName = `meechie-${this.fileBaseSlug}-${Date.now()}`;
		// Set before packaging, not after: the provider's own image is already downloadable, and
		// naming it only once the PDF exists would hand anyone who grabbed it early a file named
		// after no page in particular. Cleared by `resetPage` on its way past, so a late attempt for
		// a replaced page cannot revive it.
		this.pageFileBaseName = fileBaseName;
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

		// Recorded as attempts, and *not* into `generateError`. Both used to go there: a page that
		// generated perfectly and then failed to become a square PNG rendered in the same crimson
		// box, in the same place, as a page that never generated — directly above the button that
		// buys another generation, for a failure in a free local render. `exportError` is derived
		// from these and worded so it cannot be read that way, exactly as the home studio's is.
		this.packageAttempts = [
			{ variant: 'print', files: print.files, error: print.error, pageSize },
			{ variant: 'square', files: share.files, error: share.error, pageSize }
		];
	}

	/** Keep the page: write it into the same owner-scoped vault every other surface saves to. */
	async saveToVault(): Promise<void> {
		if (this.isSaving || !this.lastRecipe || !this.pageSource) return;
		if (this.generatedImages.length === 0) return;
		// Same guard as `canSaveToVault`, enforced here too: this class is the shared contract for
		// several surfaces and a future caller must not be able to reintroduce the ambiguity above
		// by wiring its own button.
		if (this.isGenerating) return;
		// Pinned before any await for the same reason the generation path pins its source: these
		// fields are cleared by `resetPage()`, and the record must describe the page that was on
		// screen when the button was pressed.
		const recipe = this.lastRecipe;
		const source = this.pageSource;
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
					// The source's own words, when it has any it can vouch for. Leaving this unset is
					// not neutral: the reopen path falls back to `assembledPrompt` for the quote,
					// which on a generated page is the image-generation prompt. It is still the right
					// answer for a source with no words of Meechie's to store — see `PageSource` —
					// because a fabricated verdict is worse than an absent one, and
					// `warrantForRestoredVerdict` already reads the difference.
					studioText: source.studioText ?? undefined,
					violations,
					// `fixesApplied` is deliberately omitted, not filled from `recommendedFixes`.
					// This flow never applies a recommendation and never regenerates with one, so
					// writing them into a field named "applied" records a correction that did not
					// happen — and a later reader could not tell a drifted page from a corrected
					// one. `violations` above still carries the full drift evidence, which is the
					// part that is actually true. The two older call sites
					// (`studio-state.svelte.ts`, `MeechieTools.svelte`) still write recommendations
					// here; that is a pre-existing defect in persisted-record semantics and fixing
					// it belongs in its own change.
					images: images.map((image) => ({ b64: generatedImageBase64(image) })),
					owner
				}
			});
			if (token !== this.pageToken) return;
			this.vaultStatus = result.ok
				? VAULT_SAVED_CONFIRMATION
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
}
