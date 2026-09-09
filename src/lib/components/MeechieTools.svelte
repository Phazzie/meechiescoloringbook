<!--
Purpose: Embed Meechie tools inside the main app flow, and turn any verdict into a coloring page.
Why: Keep non-technical users in one place while reusing seam-backed tools. Every tool here used
     to dead-end at a paragraph of text, which in a coloring book app is the whole product
     missing, so each verdict now prints, downloads, and saves to the vault.
Info flow: User inputs -> MeechieToolSeam -> verdict -> tool page recipe -> /api/generate ->
           preview + packaged files -> CreationStoreSeam.
Invariants: `driftReported` is independent of `violations.length` and of page presence, and must
            stay so: an empty violation list means both "checked, nothing wrong" and "no check has
            spoken", and only this flag tells them apart. When a replacement generation returns no
            decodable image, the page on screen keeps both its picture and its report; the new
            request's findings are surfaced only when there is no page to protect, because
            attaching them to a page they do not describe is what this reporting exists to stop.
            Those pageless findings belong to a REQUEST, so every path that changes the request must
            clear them. Page presence cannot stand in for that: after such a request `lastRecipe`,
            `isGenerating` and `imagePreviews` all read exactly as they do before the first one, so a
            guard written against them alone leaves the report on screen under a dedication it was
            never checked against.
-->
<script lang="ts">
	import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
	import { AiQuotaMeter } from './ai-quota-meter.svelte';
	import { MEECHIE_TOOL_QUOTA_COST } from '$lib/core/ai-quota';
	import AiQuotaLine from './AiQuotaLine.svelte';
	import { clockSeam } from '$lib/adapters/clock-seam';
	import { newCreationId } from '$lib/components/creation-id';
	import { buildQualityReport } from '$lib/core/quality-report';
	import {
		describeOriginalImageExport,
		describePackagedExports,
		summarisePageExportFailures
	} from '$lib/core/page-exports';
	import type { PageExportAttempt } from '$lib/core/page-exports';
	import PageExportRow from './PageExportRow.svelte';
	import SharePageButton from './SharePageButton.svelte';
	import QualityReportPanel from './QualityReportPanel.svelte';
	import PrintPageButton from './PrintPageButton.svelte';
	import type {
		MeechieToolInput,
		MeechieToolOutput
	} from '../../../contracts/meechie-tool.contract';
	import {
		HoroscopeSignSchema,
		MeechieToolInputSchema,
		MeechieToolResultSchema
	} from '../../../contracts/meechie-tool.contract';
	import type { GeneratedImage } from '../../../contracts/image-generation.contract';
	import type { PackagedFile } from '$lib/seams/output-packaging-seam/contract';
	import type { CreationOwner } from '$lib/seams/creation-store-seam/contract';
	import {
		classifyGenerationFailure,
		PAGE_SUBJECT,
		VERDICT_SUBJECT,
		type GenerationFailure
	} from '$lib/core/generation-failure';
	import { readIsOnline } from './connection.svelte';
	import GenerationFailureNotice from './GenerationFailureNotice.svelte';
	import { GenerateResultSchema } from '../../../contracts/generate.contract';
	import type { GenerateResponseValue } from '../../../contracts/generate.contract';
	import { outputPackagingAdapter } from '$lib/adapters/output-packaging-seam';
	import { creationStoreAdapter } from '$lib/adapters/creation-store-seam';
	import { VAULT_SAVED_CONFIRMATION } from '$lib/core/vault-page';
	import VaultStatusLine from '$lib/components/VaultStatusLine.svelte';
	import {
		classifyStorageFailure,
		type StorageFailure
	} from '$lib/core/storage-failure';
	import { sessionAdapter } from '$lib/adapters/session-seam';
	import {
		buildToolPageRecipe,
		buildToolStudioText
	} from '$lib/core/tool-page-recipe';
	import type { ToolPageRecipe } from '$lib/core/tool-page-recipe';
	import {
		generatedImageBase64,
		generatedImageDataUrl
	} from '$lib/core/generated-image-preview';

	const tools = [
		{
			id: 'apology_translator',
			label: 'Apology Autopsy',
			help: 'Drop the apology. Get what it really meant.'
		},
		{
			id: 'red_flag_or_run',
			label: 'Run Or Red Flag',
			help: 'Quick verdict with no soft landing.'
		},
		{
			id: 'wwmd',
			label: 'Meechie Move',
			help: 'One move. Clear consequence.'
		},
		{
			id: 'lineup',
			label: 'Excuse Court',
			help: 'Rank excuses from weak to embarrassing.'
		},
		{
			id: 'horoscope',
			label: 'Meechie Forecast',
			help: 'Sign read with pressure and polish.'
		},
		{
			id: 'receipts',
			label: 'Receipt Check',
			help: 'Claim versus reality, line by line.'
		},
		{
			id: 'caption_this',
			label: 'Caption Drop',
			help: 'Turn the moment into a statement line.'
		},
		{
			id: 'clapback',
			label: 'Return Fire',
			help: 'Their line in, your line out.'
		},
		{
			id: 'meechie_explains',
			label: 'Term Breakdown',
			help: 'Street glossary in plain language.'
		},
		{
			id: 'rate_excuse',
			label: 'Rate Excuse',
			help: 'Rate an excuse out of 10.'
		},
		{
			id: 'random_meechie',
			label: 'Random Meechie',
			help: 'Get a random saying.'
		}
	] as const;

	const signs = HoroscopeSignSchema.options;
	type Tool = (typeof tools)[number];
	type ToolId = (typeof tools)[number]['id'];
	const toolsById = Object.fromEntries(
		tools.map((tool) => [tool.id, tool])
	) as Record<ToolId, Tool>;

	let selectedTool: ToolId = tools[0].id;
	let output: MeechieToolOutput | null = null;
	/**
	 * The last failed verdict request, classified. See `$lib/core/generation-failure`: this hub had
	 * its own copy of the three lines that wrote an exception's own text into a crimson box.
	 */
	let verdictFailure: GenerationFailure | null = null;
	/** The input of the last verdict ATTEMPT, so a retry asks the same question. */
	let lastVerdictInput: MeechieToolInput | null = null;
	let isWorking = false;

	let apologyInput = "I'm sorry you feel that way.";
	let situationInput =
		'He said he was working late, but I saw him in the club.';
	let dilemmaInput =
		'He went silent for days, then came back like I owe him a reply.';
	let lineupPrompt = 'Rank these excuses:';
	let lineupItems: string[] = [
		'My phone died',
		'I was with the guys',
		"I didn't see your text"
	];
	let horoscopeSign: (typeof signs)[number] = signs[0];
	let claimInput = 'I never said that.';
	let realityInput =
		'Said it Tuesday, Thursday, and in the group chat on Saturday.';
	let momentInput = 'Diamond nails, city lights, and no explanations';
	let clapbackInput = "She said I'm doing too much.";
	let explainsInput = 'Situationship';
	let excuseInput = 'My alarm did not go off.';

	// Everything below belongs to the page a verdict becomes, not to the verdict itself.
	let isGenerating = false;
	let pageFailure: GenerationFailure | null = null;
	/** The verdict of the last page ATTEMPT, so a retry re-asks for the same page. */
	let lastPageVerdict: MeechieToolOutput | null = null;
	let imagePreviews: string[] = [];
	// What each packaging call was asked for and what it produced — the stored record the export row
	// and its failure sentence are both derived from, exactly as the home studio has done since the
	// row was rebuilt there. Keeping the attempts rather than only their files is what lets a
	// download name the paper it was packaged for, and lets a failure be described by the variant
	// that was *requested* rather than by a file that does not exist to read a type off.
	let packageAttempts: PageExportAttempt[] = [];
	let generatedImages: GeneratedImage[] = [];
	// The base name every download for the page on screen shares, and the provider's own image.
	// That image is the one download involving no re-rendering at all, and until now the home page
	// was the only surface in the app that offered it.
	let pageFileBaseName = '';
	let pageOriginalImage: GeneratedImage | null = null;
	$: packagedExports = describePackagedExports(packageAttempts);
	$: originalExport = describeOriginalImageExport(pageOriginalImage, pageFileBaseName);
	// The original comes last and is derived rather than stored, so it appears and disappears with
	// the page it belongs to and can never be left behind by a reset.
	$: pageExports = originalExport ? [...packagedExports, originalExport] : packagedExports;
	// A separate value from `pageFailure`, which is where both used to be written: a page that
	// generated perfectly and then failed to become a square PNG showed the same crimson box, in
	// the same place, as a page that never generated at all.
	$: exportError = summarisePageExportFailures(packageAttempts);
	let assembledPrompt = '';
	let revisedPrompt = '';
	// Drift diagnostics from `/api/generate`. The provider's revised prompt can drop an exact-text
	// or layout requirement; discarding these would present a drifted page as a clean one and lose
	// the evidence for good. Surfaced below the preview and persisted with the saved page, which is
	// what the studio flow does.
	let violations: GenerateResponseValue['violations'] = [];
	let recommendedFixes: GenerateResponseValue['recommendedFixes'] = [];
	// True once the drift check has reported on the page currently on screen. `violations.length`
	// cannot stand in for this: an empty list is both "checked, nothing wrong" and "not checked",
	// and the block below used to render the second as the first by showing nothing at all.
	let driftReported = false;
	// Why the drift check returned no verdict, when `/api/generate` said it returned none.
	let driftCheckFailure: GenerateResponseValue['driftCheckFailure'] = undefined;
	// The same transform the home studio and the mode routes use, so all three surfaces agree on
	// what a warning is, what an unfinished check is, and when silence means clean.
	$: qualityReport = buildQualityReport({
		// Page presence and check completion are separate facts; see `buildQualityReport`.
		hasPage: imagePreviews.length > 0,
		driftChecked: driftReported,
		violations,
		recommendedFixes,
		driftCheckFailure
	});
	let lastRecipe: ToolPageRecipe | null = null;
	// The verdict the currently displayed page was built from. Kept separate from `output`, which
	// changes the moment the user switches tools or asks for a new take.
	let pageVerdict: MeechieToolOutput | null = null;
	// Incremented whenever the displayed page stops being current. An in-flight generation
	// compares its own token against this and discards itself if it lost the race.
	// Two independent request lifetimes, two tokens. `/api/tools` (the verdict) and `/api/generate`
	// (the page) can be in flight at once, and a page-only action must not cancel a pending verdict.
	let pageToken = 0;
	let verdictToken = 0;
	// Both buckets, on the surface that spends both: eleven tools charge `text`, and the page
	// button beneath them charges `image`. The hub reported neither until now.
	const quota = new AiQuotaMeter();
	let dedicatedTo = '';
	let copyStatus = '';
	let vaultStatus = '';
	// The classified failure behind `vaultStatus`, where it is reporting one. This component is
	// still in legacy (non-runes) mode, so this is a plain `let` reassigned on each save like every
	// other piece of its state — the same value `PageArtifactState` holds as `$state` elsewhere.
	let vaultSaveFailure: StorageFailure | null = null;
	let isSaving = false;
	let owner: CreationOwner | null = null;

	// The vault is owner-scoped, so the session id has to be in hand before a save can be
	// attempted. Resolving it up front means the Save button can say why it is unavailable
	// instead of failing at the click.
	const loadOwner = async (): Promise<void> => {
		const result = await sessionAdapter.getSession();
		if (result.ok) {
			owner = { kind: 'anonymous', sessionId: result.value.sessionId };
		}
	};
	void loadOwner();

	/**
	 * Drop the generated page. Called whenever the verdict it was built from stops being current.
	 *
	 * Bumping the token here is what cancels an in-flight generation: the request cannot be
	 * recalled, but its result is discarded on arrival instead of landing under a newer verdict.
	 * `isGenerating` is released with it, so abandoning a slow generation does not wedge the
	 * button for the next one.
	 */
	/**
	 * Classify one failed call from this hub, with the context only this component holds.
	 *
	 * Two helpers rather than one because the two calls spend different buckets and mean different
	 * things to a reader: a verdict refused for quota refills on the TEXT window, a page on the
	 * IMAGE one, and naming the wrong instant is the bucket mix-up `AiQuotaLedger` exists to prevent.
	 */
	const classifyVerdictFailure = (
		input: Pick<
			Parameters<typeof classifyGenerationFailure>[0],
			'thrown' | 'apiError' | 'offContract' | 'rejected'
		>
	): GenerationFailure =>
		classifyGenerationFailure({
			...input,
			subject: VERDICT_SUBJECT,
			pageKept: false,
			quotaResetAtMs: quota.text?.resetAtMs ?? null,
			isOnline: readIsOnline()
		});

	const classifyPageFailure = (
		input: Pick<
			Parameters<typeof classifyGenerationFailure>[0],
			'thrown' | 'apiError' | 'offContract' | 'undecodable'
		>
	): GenerationFailure =>
		classifyGenerationFailure({
			...input,
			subject: PAGE_SUBJECT,
			pageKept: generatedImages.length > 0,
			quotaResetAtMs: quota.image?.resetAtMs ?? null,
			isOnline: readIsOnline()
		});

	const resetPage = (): void => {
		pageToken += 1;
		// Only the page flag is released here. `isWorking` belongs to the verdict request and is
		// released by `resetVerdict`; releasing it from a page-only action used to abandon a
		// perfectly good verdict request that the reader had never cancelled.
		isGenerating = false;
		pageFailure = null;
		lastPageVerdict = null;
		imagePreviews = [];
		packageAttempts = [];
		pageOriginalImage = null;
		pageFileBaseName = '';
		generatedImages = [];
		assembledPrompt = '';
		revisedPrompt = '';
		violations = [];
		recommendedFixes = [];
		driftReported = false;
		driftCheckFailure = undefined;
		lastRecipe = null;
		pageVerdict = null;
		vaultStatus = '';
		copyStatus = '';
	};

	/**
	 * Abandon an in-flight verdict request.
	 *
	 * Separate from `resetPage` because the two are separate requests with separate lifetimes.
	 * While a verdict is pending the reader can still press Make Page or edit the dedication on the
	 * verdict already on screen — both page-only actions. Those called `resetPage`, which advanced
	 * the single shared token that `handleGenerate` had captured, so the verdict arrived, was read
	 * as stale, and was thrown away though nobody had cancelled it.
	 *
	 * `isWorking` is released here rather than in the request's own `finally`, because the
	 * staleness guard deliberately stops an abandoned request from clearing a newer one's flag —
	 * which leaves the abandoned request clearing nothing at all.
	 */
	const resetVerdict = (): void => {
		verdictToken += 1;
		isWorking = false;
	};

	const resetState = (): void => {
		verdictFailure = null;
		lastVerdictInput = null;
		output = null;
		resetVerdict();
		resetPage();
	};

	/**
	 * The dedication is baked into the spec at generation time, so editing it after a page exists
	 * leaves a page, a download and a vault record carrying the previous value while the form shows
	 * the new one. Drop the generated page instead, so the only thing on offer matches the field.
	 */
	const handleDedicationInput = (): void => {
		// `isGenerating` matters as much as an installed page: while `/api/generate` or packaging
		// is still pending, `lastRecipe` and `imagePreviews` are both empty, so checking only those
		// would return without bumping the token — and the in-flight page, built with the previous
		// dedication, would then land beneath the new one.
		//
		// `driftReported` is the same argument one step further out, and the reason the first three
		// are not enough on their own. A request whose image could not be decoded installs no page
		// and leaves nothing generating, but it does leave its own findings on screen — so all three
		// read false while a report describing the previous prompt is still rendered. Returning early
		// there left that report sitting under a dedication it was never checked against.
		if (
			!isGenerating &&
			lastRecipe === null &&
			imagePreviews.length === 0 &&
			!driftReported
		)
			return;
		resetPage();
	};

	/**
	 * Whether the browser can actually decode this preview.
	 *
	 * A byte-signature check is not enough: a truncated response keeps a valid PNG header while the
	 * image itself is missing, and both `<img>` and `pdf-lib` reject it. Decoding is the only answer
	 * to "can this be shown and printed?" that is not a proxy for it. Outside a browser there is
	 * nothing to decode with, so this does not block there.
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

	/**
	 * Build the page for one verdict.
	 *
	 * Takes the verdict rather than reading `output`, so a retry re-asks for the page that failed
	 * rather than for whichever tool the reader has since switched to. `handleMakePage` passes the
	 * live one; `handleRetryPage` passes the one that was actually attempted.
	 */
	const makePageFor = async (source: MeechieToolOutput | null): Promise<void> => {
		// `pictureExhausted` is the gate as well as the control: this hub has its own handlers rather
		// than `PageArtifactState`'s, so the guard there does not reach it.
		if (!source || isGenerating || quota.pictureExhausted()) return;
		// Advance the token without clearing anything. Any earlier in-flight run is stale from here,
		// but the page already on screen stays: it cost a paid generation, and until a replacement
		// has actually arrived it is the best thing this component has. Calling `resetPage()` here
		// meant a timeout, a provider error or an off-contract response deleted a good page and left
		// the reader with nothing — the same defect as the verdict path, on the page path.
		pageToken += 1;
		pageFailure = null;
		vaultStatus = '';
		copyStatus = '';
		isGenerating = true;
		// Recorded before the request, so a retry re-asks for this page rather than for whatever
		// verdict is on screen by the time the failure lands.
		lastPageVerdict = source;

		// Pin the verdict this run belongs to, and take a token for it.
		//
		// `/api/generate` is slow enough to switch tools underneath, and `resetState()` sets
		// `output` to null on the way. Without this, a response arriving late would repopulate the
		// page state beneath a different verdict — showing and saving tool A's image under tool B's
		// words — and reading `output.toolId` after the await would throw outright once `output`
		// had been cleared. Everything below reads `verdict` and re-checks the token instead.
		const verdict = source;
		const token = pageToken;
		const isStale = (): boolean => token !== pageToken;
		const recipe = buildToolPageRecipe(verdict, { dedication: dedicatedTo });
		const generateRequestedAtMs = clockSeam.now();
		try {
			const payload = await postJson(
				'/api/generate',
				{ spec: recipe.spec, styleHint: recipe.styleHint },
				{
					timeoutMs: POST_JSON_TIMEOUTS_MS.generate,
					// The image bucket. Anchored at send — see `AiQuotaMeter`'s invariants.
					onResponseHeaders: (headers) =>
						quota.record(headers, generateRequestedAtMs, 'image')
				}
			);
			if (isStale()) return;
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				pageFailure = classifyPageFailure({ offContract: true });
				return;
			}
			if (!parsed.data.ok) {
				pageFailure = classifyPageFailure({ apiError: parsed.data.error });
				return;
			}

			// A contract-valid response is not yet a usable page. `data` is only
			// `NonEmptyStringSchema`, and the image pipeline labels bytes it cannot identify as
			// `png`, so nonempty garbage arrives here as a well-formed PNG: it renders as a broken
			// tile, `embedPng` throws on it, and it can be saved to the vault in that state.
			// Installing it would destroy a good page for an unusable one — the same defect as
			// clearing before the response arrived, one step further along.
			//
			// The check is a real decode, not a byte-signature test. A signature test passes a
			// truncated response — a PNG header with the image missing — which is exactly what a
			// connection dropped mid-body produces, and `embedPng` still throws on it. Asking the
			// browser to decode the bytes answers "can this be shown and printed?" directly instead
			// of by proxy. Drop what will not decode and keep the page on screen if nothing does.
			const decoded = await Promise.all(
				parsed.data.value.images.map(async (image) => {
					// Built once: the decode probe and the preview must be the same URL, and
					// deriving it twice invites them to drift apart under a later edit.
					const preview = generatedImageDataUrl(image);
					return { image, preview, usable: await canDecodeImage(preview) };
				})
			);
			if (isStale()) return;
			const usable = decoded.filter((entry) => entry.usable);
			if (usable.length === 0) {
				pageFailure = classifyPageFailure({ undecodable: true });
			// With no page already on screen there is nothing to protect, so the request's own findings
			// are the most useful thing the reader can be given — the home studio records its trace
			// above its no-picture guard for exactly this reason. When a page *is* on screen it keeps
			// its own report: attaching this request's findings to a page they do not describe is the
			// conflation this whole change exists to remove, so the fix is conditional rather than
			// simply hoisting the assignment above the guard.
				if (generatedImages.length === 0) {
					violations = parsed.data.value.violations;
					recommendedFixes = parsed.data.value.recommendedFixes;
					driftCheckFailure = parsed.data.value.driftCheckFailure;
					driftReported = true;
				}
				return;
			}
			const images = usable.map((entry) => entry.image);

			// Install the page before packaging it. The generation is the paid part and it has
			// already succeeded here; packaging is a local render that can fail on its own. Leaving
			// the install until after meant any packaging problem skipped it entirely and threw the
			// whole page away.
			//
			// The status lines describe the page being replaced, so they go with it. A save that was
			// started before this swap is caught by `handleSaveToVault`'s own recipe check rather
			// than by the token — bumping the token here would make this very run read itself as
			// stale and wedge the button.
			vaultStatus = '';
			copyStatus = '';
			pageVerdict = verdict;
			lastRecipe = recipe;
			generatedImages = images;
			assembledPrompt = parsed.data.value.prompt;
			revisedPrompt = parsed.data.value.revisedPrompt ?? '';
			violations = parsed.data.value.violations;
			recommendedFixes = parsed.data.value.recommendedFixes;
			driftReported = true;
			driftCheckFailure = parsed.data.value.driftCheckFailure;
			imagePreviews = usable
				.map((entry) => entry.preview)
				.filter((url): url is string => url !== null);
			packageAttempts = [];
			pageOriginalImage = null;
			pageFileBaseName = '';

			// Two calls, not one with `variants: ['print', 'square']`. The adapter builds the print
			// file first and then returns the square failure *without* its accumulated files, so a
			// browser that cannot encode the 1080px share canvas would take the printable PDF down
			// with it. The PDF is the product; the square image is a nicety.
			//
			// Each call is caught on its own, because the adapter does not wrap every failure into a
			// `Result` — pdf-lib and the canvas both throw. A rejection from the square call used to
			// escape to the outer catch and discard the print PDF that had already been built.
			const fileBaseName = `meechie-${verdict.toolId}-${Date.now()}`;
			// Named before packaging, not after: the provider's own image is downloadable the moment
			// the page lands, and naming it only once the PDF exists hands anyone who grabbed it
			// early a file named after no page in particular.
			pageFileBaseName = fileBaseName;
			pageOriginalImage = images[0] ?? null;
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

			// Recorded as attempts, and not into `pageFailure`. Packaging runs after the paid
			// generation has already succeeded, so a failure here never means the page failed —
			// and reporting it in the field a failed generation uses, above the button that buys
			// another one, is an invitation to pay again for a free local render.
			packageAttempts = [
				{ variant: 'print', files: print.files, error: print.error, pageSize: recipe.spec.pageSize },
				{ variant: 'square', files: share.files, error: share.error, pageSize: recipe.spec.pageSize }
			];
		} catch (requestError) {
			if (isStale()) return;
			pageFailure = classifyPageFailure({ thrown: requestError });
		} finally {
			if (!isStale()) isGenerating = false;
		}
	};

	const handleSaveToVault = async (): Promise<void> => {
		if (isSaving || !lastRecipe || !pageVerdict || generatedImages.length === 0)
			return;
		if (!owner) {
			vaultStatus = 'Session is still connecting. Try again in a moment.';
			return;
		}
		isSaving = true;
		vaultSaveFailure = null;
		vaultStatus = 'Saving...';
		// Same staleness rule as generation: the record below is built synchronously from the
		// current page, but the write is awaited, so its status must not be painted over a page
		// the user has since replaced.
		//
		// The recipe is the whole test, and the token is deliberately not part of it. `lastRecipe`
		// is replaced by reference the moment a new page installs and set to null when the page is
		// dropped, so comparing it asks the exact question — "is the page this save was for still
		// the page on screen?" — for every way the answer can become no.
		//
		// Adding the token made it answer a different question. `handleMakePage` advances the token
		// when a regeneration *starts*, so a save begun just before one was ruled stale even when
		// that regeneration then failed and left the original page in place. The write had already
		// succeeded; only its confirmation vanished, which invites a second Save and a duplicate
		// vault entry for a page that was saved correctly the first time.
		//
		// Not covered by an end-to-end test, deliberately and not silently: the vault write goes to
		// localStorage through the adapter rather than over the network, so a Playwright route stub
		// cannot hold it open across the regeneration that the race requires. A test that clicked
		// Save and then regenerated passed with this guard removed — it was measuring the up-front
		// `vaultStatus` clear in `handleMakePage`, not this — so it was deleted rather than kept as
		// false coverage.
		const savedRecipe = lastRecipe;
		const isStaleSave = (): boolean => lastRecipe !== savedRecipe;
		try {
			const result = await creationStoreAdapter.saveCreation({
				record: {
					// One generator, shared with the other twelve savers. The fallback this replaced
					// was `creation-${Date.now()}`, and a save replaces any record sharing its id —
					// so two saves in one millisecond destroyed the first. See `newCreationId`.
					id: newCreationId(),
					// Through `ClockSeam`, not `new Date()`: this file already imports the clock for
					// its quota meter, and `AGENTS.md` classifies clock/time as a seam.
					createdAtISO: new Date(clockSeam.now()).toISOString(),
					intent: lastRecipe.spec,
					assembledPrompt,
					revisedPrompt: revisedPrompt || undefined,
					// Store the verdict's own text. Leaving this unset is not neutral: the reopen
					// path falls back to `assembledPrompt` for the quote, which on a generated page
					// is the image-generation prompt, and to the default landlord page items when
					// the saved spec has none. See `buildToolStudioText`.
					// `?? undefined`, not a cast: `buildToolStudioText` returns null when the verdict
					// has no printable words to build a contract-valid record from, and omitting the
					// field keeps the save itself valid rather than losing the page.
					studioText: buildToolStudioText(pageVerdict, lastRecipe) ?? undefined,
					violations,
					// `fixesApplied` is deliberately omitted, not filled from `recommendedFixes`.
					// This hub never applies a recommendation and never regenerates with one, so
					// writing them into a field named "applied" recorded a correction that did not
					// happen, leaving a later reader unable to tell a drifted page from a corrected
					// one. `violations` above still carries the full drift evidence.
					images: generatedImages.map((image) => ({
						b64: generatedImageBase64(image)
					})),
					owner
				}
			});
			if (isStaleSave()) return;
			// The capacity refusals this app wrote come back verbatim, so `vaultLinkFor` still
			// matches them exactly and still offers "Make room in the vault". Everything else
			// becomes a sentence, and the seam's own words stop reaching the screen.
			vaultSaveFailure = result.ok ? null : classifyStorageFailure('save', result.error);
			vaultStatus = result.ok
				? VAULT_SAVED_CONFIRMATION
				: (vaultSaveFailure?.message ?? VAULT_SAVED_CONFIRMATION);
		} catch (saveError) {
			if (isStaleSave()) return;
			// Was the caught exception's own message. See `src/lib/core/storage-failure.ts`.
			vaultSaveFailure = classifyStorageFailure('save', saveError);
			vaultStatus = vaultSaveFailure.message;
		} finally {
			isSaving = false;
		}
	};

	const handleCopyVerdict = async (): Promise<void> => {
		if (!output) return;
		// A permission prompt can hold this open long enough for the user to move on. Reporting
		// "Verdict copied." under a newer verdict would invite them to paste the previous one.
		const verdict = output;
		const token = pageToken;
		try {
			await navigator.clipboard.writeText(
				`${verdict.headline}\n\n${verdict.response}`
			);
			if (token !== pageToken || output !== verdict) return;
			copyStatus = 'Verdict copied.';
		} catch {
			if (token !== pageToken || output !== verdict) return;
			copyStatus = 'Copy unavailable in this browser.';
		}
	};

	const addLineupItem = (): void => {
		if (lineupItems.length >= 6) {
			return;
		}
		lineupItems = [...lineupItems, ''];
	};

	const removeLineupItem = (index: number): void => {
		if (lineupItems.length <= 1) {
			return;
		}
		lineupItems = lineupItems.filter((_, idx) => idx !== index);
	};

	const updateLineupItem = (index: number, value: string): void => {
		lineupItems = lineupItems.map((item, idx) =>
			idx === index ? value : item
		);
	};

	const buildInput = (): MeechieToolInput => {
		switch (selectedTool) {
			case 'apology_translator':
				return { toolId: selectedTool, apology: apologyInput };
			case 'red_flag_or_run':
				return { toolId: selectedTool, situation: situationInput };
			case 'wwmd':
				return { toolId: selectedTool, dilemma: dilemmaInput };
			case 'lineup':
				return {
					toolId: selectedTool,
					prompt: lineupPrompt,
					items: lineupItems
				};
			case 'horoscope':
				return { toolId: selectedTool, sign: horoscopeSign };
			case 'receipts':
				return {
					toolId: selectedTool,
					claim: claimInput,
					reality: realityInput
				};
			case 'caption_this':
				return { toolId: selectedTool, moment: momentInput };
			case 'clapback':
				return { toolId: selectedTool, comment: clapbackInput };
			case 'meechie_explains':
				return { toolId: selectedTool, term: explainsInput };
			case 'rate_excuse':
				return { toolId: selectedTool, excuse: excuseInput };
			case 'random_meechie':
				return { toolId: selectedTool };
			default: {
				const _exhaustive: never = selectedTool;
				throw new Error(`Unhandled tool selection: ${_exhaustive}`);
			}
		}
	};

	/**
	 * Ask the selected tool for a verdict.
	 *
	 * `retryInput` short-circuits the form read: a retry re-sends the question that was actually
	 * asked, because the form stays editable while the failure is on screen and reading it live
	 * would send a different one under a control that says "again".
	 */
	const askMeechie = async (
		retryInput: MeechieToolInput | null = null
	): Promise<void> => {
		if (quota.textExhausted(MEECHIE_TOOL_QUOTA_COST)) return;
		// Only the stale error goes now. The verdict and the page it produced are what the reader is
		// looking at, and they cost a paid generation: clearing them up front meant an empty required
		// field, a timeout, a provider error or an off-contract response silently destroyed a page
		// that was still perfectly good, with nothing to restore it from. Nothing on screen is
		// replaced until a replacement has actually arrived.
		verdictFailure = null;
		const parsedInput = retryInput
			? ({ success: true, data: retryInput } as const)
			: MeechieToolInputSchema.safeParse(buildInput());
		if (!parsedInput.success) {
			verdictFailure = classifyVerdictFailure({
				rejected: 'Please complete the required fields before generating.'
			});
			return;
		}
		isWorking = true;
		lastVerdictInput = parsedInput.data;

		// The verdict fetch needs the same staleness guard as the page generation. `/api/tools` for
		// tool A can still be in flight when the user switches to tool B: the tab handler clears
		// the state but cannot recall the request, so A's response would install itself as `output`
		// under B's tab — and the next click would spend a paid generation on A's verdict while the
		// screen showed B.
		const requestedTool = selectedTool;
		const token = verdictToken;
		const isStale = (): boolean =>
			token !== verdictToken || selectedTool !== requestedTool;
		// Recorded rather than recomputed at the end, because the success path calls `resetState()`,
		// which bumps `pageToken` itself. Re-asking `isStale()` in the `finally` after that would
		// read its own reset as someone else's and leave the button disabled forever.
		let abandoned = false;

		const toolRequestedAtMs = clockSeam.now();

		try {
			const payload = await postJson('/api/tools', parsedInput.data, {
				timeoutMs: POST_JSON_TIMEOUTS_MS.tools,
				// The text bucket, which every one of the eleven tools spends. Unguarded by
				// `isStale()`: the server charged this caller whatever the reader did next.
				onResponseHeaders: (headers) =>
					quota.record(headers, toolRequestedAtMs, 'text')
			});
			if (isStale()) {
				abandoned = true;
				return;
			}
			const parsedResult = MeechieToolResultSchema.safeParse(payload);
			if (!parsedResult.success) {
				verdictFailure = classifyVerdictFailure({ offContract: true });
				return;
			}

			if (parsedResult.data.ok) {
				// Here, and only here, does what is on screen stop belonging to what is on screen.
				resetState();
				output = parsedResult.data.value;
			} else {
				verdictFailure = classifyVerdictFailure({
					apiError: parsedResult.data.error
				});
			}
		} catch (requestError) {
			if (isStale()) {
				abandoned = true;
				return;
			}
			verdictFailure = classifyVerdictFailure({ thrown: requestError });
		} finally {
			// A request the user abandoned must not clear the flag a newer one is holding; the
			// abandoning reset released it already.
			if (!abandoned) isWorking = false;
		}
	};

	// Bound to the controls. Wrappers rather than the functions themselves, because `on:click` would
	// otherwise pass the MouseEvent as the first argument — which for `askMeechie` is the input it
	// would then send instead of the reader's answers.
	const handleGenerate = (): Promise<void> => askMeechie();
	const handleRetryVerdict = (): Promise<void> => askMeechie(lastVerdictInput);
	const handleMakePage = (): Promise<void> => makePageFor(output);
	const handleRetryPage = (): Promise<void> => makePageFor(lastPageVerdict);
</script>

<section class="meechie">
	<section class="tool-picker" aria-label="Select a tool">
		<p class="label">Choose your tool</p>
		<div class="tool-tabs" role="tablist">
			{#each tools as tool}
				<button
					role="tab"
					type="button"
					class="tool-tab"
					class:active={selectedTool === tool.id}
					data-testid={`meechie-tool-${tool.id}`}
					aria-selected={selectedTool === tool.id}
					on:click={() => {
						selectedTool = tool.id;
						resetState();
					}}
				>
					{tool.label}
				</button>
			{/each}
		</div>
		<p class="help">{toolsById[selectedTool].help}</p>
	</section>

	<section class="form">
		{#if selectedTool === 'apology_translator'}
			<label class="label" for="apology">Apology received</label>
			<textarea id="apology" bind:value={apologyInput} rows="3"></textarea>
		{:else if selectedTool === 'red_flag_or_run'}
			<label class="label" for="situation">Situation</label>
			<textarea id="situation" bind:value={situationInput} rows="3"></textarea>
		{:else if selectedTool === 'wwmd'}
			<label class="label" for="dilemma">Dilemma</label>
			<textarea id="dilemma" bind:value={dilemmaInput} rows="3"></textarea>
		{:else if selectedTool === 'lineup'}
			<label class="label" for="lineup-prompt">Prompt</label>
			<input id="lineup-prompt" bind:value={lineupPrompt} />
			<div class="lineup-items">
				{#each lineupItems as item, index}
					<div class="lineup-row">
						<input
							value={item}
							on:input={(event) =>
								updateLineupItem(
									index,
									(event.target as HTMLInputElement).value
								)}
						/>
						<button
							class="ghost"
							type="button"
							data-testid="meechie-lineup-remove"
							disabled={lineupItems.length <= 1}
							on:click={() => removeLineupItem(index)}
						>
							Remove
						</button>
					</div>
				{/each}
				<button
					class="ghost"
					type="button"
					data-testid="meechie-lineup-add"
					disabled={lineupItems.length >= 6}
					on:click={addLineupItem}>Add item</button
				>
			</div>
		{:else if selectedTool === 'horoscope'}
			<label class="label" for="sign">Sign</label>
			<select id="sign" bind:value={horoscopeSign}>
				{#each signs as sign}
					<option value={sign}>{sign}</option>
				{/each}
			</select>
		{:else if selectedTool === 'receipts'}
			<label class="label" for="claim">Claim</label>
			<input id="claim" bind:value={claimInput} />
			<label class="label" for="reality">Reality</label>
			<input id="reality" bind:value={realityInput} />
		{:else if selectedTool === 'caption_this'}
			<label class="label" for="moment">Moment</label>
			<textarea id="moment" bind:value={momentInput} rows="2"></textarea>
		{:else if selectedTool === 'clapback'}
			<label class="label" for="comment">What they said</label>
			<textarea id="comment" bind:value={clapbackInput} rows="2"></textarea>
		{:else if selectedTool === 'meechie_explains'}
			<label class="label" for="term">Term</label>
			<input id="term" bind:value={explainsInput} />
		{:else if selectedTool === 'rate_excuse'}
			<label class="label" for="excuse">Excuse</label>
			<input id="excuse" bind:value={excuseInput} />
		{:else if selectedTool === 'random_meechie'}
			<p class="help">No input needed. Just press the button.</p>
		{/if}
	</section>

	<section class="actions">
		<button
			class="primary"
			type="button"
			data-testid="meechie-tool-generate"
			on:click={handleGenerate}
			aria-describedby={quota.textMessage({
				actionNoun: 'take',
				unitsPerAction: MEECHIE_TOOL_QUOTA_COST
			})
				? 'text-budget'
				: undefined}
			disabled={isWorking || quota.textExhausted(MEECHIE_TOOL_QUOTA_COST)}
		>
			{#if isWorking}
				<span class="working-inner">
					<span class="working-dot" aria-hidden="true"></span>
					Reading the situation…
				</span>
			{:else}
				Get Meechie's Take
			{/if}
		</button>
		<AiQuotaLine
			message={quota.textMessage({
				actionNoun: 'take',
				unitsPerAction: MEECHIE_TOOL_QUOTA_COST
			})}
			testId="meechie-tool-text-quota"
			id="text-budget"
		/>
	</section>

	<GenerationFailureNotice
		failure={verdictFailure}
		onRetry={() => void handleRetryVerdict()}
		isBusy={isWorking || isGenerating}
		testId="meechie-tool-error"
	/>

	{#if output}
		<section class="output" data-testid="meechie-tool-output">
			<div class="verdict-badge" aria-hidden="true">
				<span class="verdict-label">Verdict</span>
				<span class="verdict-crown">♛</span>
			</div>
			<h3>{output.headline}</h3>
			<p class="verdict-body">{output.response}</p>
			<div class="verdict-actions">
				<button
					class="ghost"
					type="button"
					data-testid="meechie-tool-copy"
					on:click={handleCopyVerdict}
				>
					Copy the verdict
				</button>
				{#if copyStatus}
					<span class="status" data-testid="meechie-tool-copy-status"
						>{copyStatus}</span
					>
				{/if}
			</div>
		</section>

		<section class="page-factory" data-testid="meechie-tool-page-factory">
			<p class="eyebrow">Put It On Paper</p>
			<h3>Make the coloring page</h3>
			<p class="factory-sub">
				Print it. Color it. Send it to whoever needs to see it.
			</p>

			<div class="field">
				<label class="label" for="tool-dedication"
					>Dedicated to (optional)</label
				>
				<input
					id="tool-dedication"
					data-testid="meechie-tool-dedication"
					bind:value={dedicatedTo}
					on:input={handleDedicationInput}
					maxlength="60"
					placeholder="He had time to know better."
				/>
			</div>

			<GenerationFailureNotice
				failure={pageFailure}
				onRetry={() => void handleRetryPage()}
				isBusy={isGenerating || isWorking}
				testId="meechie-tool-generate-error"
			/>

			<button
				class="primary"
				type="button"
				data-testid="meechie-tool-make-page"
				on:click={handleMakePage}
				aria-describedby={quota.pictureMessage() ? 'page-budget' : undefined}
				disabled={isGenerating || quota.pictureExhausted()}
			>
				{#if isGenerating}
					<span class="working-inner">
						<span class="working-dot" aria-hidden="true"></span>
						Printing the truth…
					</span>
				{:else}
					Generate My Coloring Page
				{/if}
			</button>
			<AiQuotaLine
				message={quota.pictureMessage()}
				testId="meechie-tool-page-quota"
				id="page-budget"
			/>

			<QualityReportPanel
				report={qualityReport}
				cleanTestId="meechie-tool-clean"
				flaggedTestId="meechie-tool-violations"
				fixesTestId="meechie-tool-fixes"
			/>

			{#if imagePreviews.length > 0}
				<!-- Marked in place: the picture on screen is the sheet that prints. See
				     `PrintPageButton.svelte` and the `@media print` block in `+layout.svelte`. -->
				<div class="preview-grid" data-testid="meechie-tool-preview">
					{#each imagePreviews as preview}
						<figure data-print-sheet>
							<img src={preview} alt="Meechie coloring page" />
						</figure>
					{/each}
				</div>

				<!--
					The shared export row. This hub used to render `{#each packagedFiles as file}` with
					`{file.filename}` as the link text, so eleven tools each ended in two links reading
					`meechie-who-fucked-up-1788784316892.pdf` — no idea what either file was for, no
					size, and no way at all to get the provider's own image.
				-->
				<PageExportRow {exportError} exports={pageExports} testIdPrefix="meechie-tool" />

				<div class="page-actions">
					<button
						class="ghost"
						type="button"
						data-testid="meechie-tool-save-vault"
						on:click={handleSaveToVault}
						disabled={isSaving}
					>
						{isSaving ? 'Saving…' : 'Save to the vault'}
					</button>
					<!-- `lastRecipe`, not the live verdict: the sheet coming out of the printer is
					     the page on screen, and the hub keeps showing page A while B generates. -->
					<PrintPageButton
						sheetCount={imagePreviews.length}
						pageTitle={lastRecipe?.spec.title ?? null}
						testId="meechie-tool-print"
					/>
					<!-- `pageVerdict`, not `output`: the hub keeps showing page A while B generates,
					     and sending from the live verdict would caption A's picture with B's words. -->
					<SharePageButton
						exports={pageExports}
						pageTitle={lastRecipe?.spec.title ?? null}
						quote={pageVerdict?.headline ?? null}
						testId="meechie-tool-share"
					/>
				</div>
				<VaultStatusLine
					status={vaultStatus}
					failure={vaultSaveFailure}
					onRetry={() => void handleSaveToVault()}
					isBusy={isSaving}
					testId="meechie-tool-vault-status"
				/>
			{/if}
		</section>
	{/if}
</section>

<style>
	.meechie {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.8rem;
		padding: 2.2rem;
		border-radius: 1rem;
		background: var(--dark-card, #16142a);
		border: 1px solid rgba(201, 162, 39, 0.28);
		box-shadow: 0 24px 56px rgba(0, 0, 0, 0.55);
		overflow: hidden;
	}

	.meechie::before {
		content: '';
		position: absolute;
		top: -60px;
		right: -40px;
		width: 260px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(232, 0, 106, 0.14),
			transparent 65%
		);
		pointer-events: none;
	}

	/* Tool tabs */
	.tool-picker {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		position: relative;
		z-index: 1;
	}

	.tool-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.tool-tab {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.4rem 0.9rem;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.25);
		background: transparent;
		color: rgba(253, 246, 227, 0.55);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.tool-tab:hover {
		color: var(--cream, #fdf6e3);
		border-color: rgba(201, 162, 39, 0.5);
	}

	.tool-tab.active {
		background: rgba(232, 0, 106, 0.15);
		border-color: rgba(232, 0, 106, 0.6);
		color: var(--cream, #fdf6e3);
	}

	.form,
	.actions,
	.output {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
		z-index: 1;
	}

	.label {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-weight: 700;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--gold, #c9a227);
		margin: 0;
	}

	textarea,
	input,
	select {
		padding: 0.65rem 0.8rem;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.22);
		font-size: 0.95rem;
		font-family: inherit;
		background: rgba(7, 7, 15, 0.65);
		color: var(--cream, #fdf6e3);
		transition:
			border-color 0.18s ease,
			box-shadow 0.18s ease;
	}

	textarea::placeholder,
	input::placeholder {
		color: rgba(184, 170, 207, 0.4);
	}

	select option {
		background: #1c1932;
		color: #fdf6e3;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--gold, #c9a227);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.15);
	}

	.help {
		color: var(--lavender, #b8aacf);
		font-size: 0.87rem;
		margin: 0;
		font-style: italic;
	}

	/* Primary action */
	.primary {
		align-self: flex-start;
		padding: 0.78rem 1.6rem;
		border-radius: 4px;
		border: none;
		background: linear-gradient(
			112deg,
			var(--fuchsia, #e8006a),
			#8b16c2 52%,
			var(--gold, #c9a227)
		);
		color: #fff;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
	}

	.primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 32px rgba(232, 0, 106, 0.38);
		filter: saturate(1.1) brightness(1.06);
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.working-inner {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}

	.working-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fff;
		animation: pulse-dot 1.1s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.7);
		}
	}

	/* Lineup */
	.lineup-items {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.lineup-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.lineup-row input {
		flex: 1;
	}

	.ghost {
		border: 1px solid rgba(201, 162, 39, 0.3);
		background: transparent;
		padding: 0.38rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold-bright, #f0c44a);
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.ghost:hover {
		border-color: rgba(201, 162, 39, 0.6);
		background: rgba(201, 162, 39, 0.07);
	}


	/* Verdict output */
	.output {
		padding: 1.6rem;
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.75);
		border: 1px solid rgba(201, 162, 39, 0.22);
		border-top: 3px solid var(--fuchsia, #e8006a);
		animation: verdict-in 0.35s ease;
	}

	@keyframes verdict-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.verdict-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	.verdict-label {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--fuchsia, #e8006a);
	}

	.verdict-crown {
		font-size: 0.85rem;
		color: var(--gold, #c9a227);
		filter: drop-shadow(0 0 6px rgba(201, 162, 39, 0.5));
	}

	.output h3 {
		margin: 0 0 0.9rem;
		color: var(--cream, #fdf6e3);
		font-family: var(--font-display, 'Fraunces', 'Times New Roman', serif);
		font-style: italic;
		font-size: clamp(1.25rem, 3vw, 1.65rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.verdict-body {
		margin: 0;
		color: rgba(253, 246, 227, 0.85);
		line-height: 1.65;
		font-size: 0.97rem;
		white-space: pre-wrap;
	}

	.verdict-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.status {
		margin: 0;
		font-size: 0.83rem;
		color: var(--emerald, #00c896);
		font-weight: 600;
	}

	/* Page factory — the verdict becomes a printable page here */
	.page-factory {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		position: relative;
		z-index: 1;
		padding: 1.6rem;
		border-radius: 6px;
		background: var(--dark-card-alt, #1c1932);
		border: 1px solid rgba(201, 162, 39, 0.22);
	}

	.eyebrow {
		margin: 0;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--gold, #c9a227);
	}

	.page-factory h3 {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', 'Times New Roman', serif);
		font-style: italic;
		font-weight: 800;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
		color: var(--cream, #fdf6e3);
	}

	.factory-sub {
		margin: 0;
		color: var(--lavender, #b8aacf);
		font-size: 0.9rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.9rem;
	}

	.preview-grid figure {
		margin: 0;
		padding: 0.5rem;
		border-radius: 4px;
		background: rgba(253, 246, 227, 0.06);
		border: 1px solid rgba(201, 162, 39, 0.2);
	}

	.preview-grid img {
		display: block;
		width: 100%;
		height: auto;
		/* A coloring page is portrait US Letter. Uncapped, one preview pushes the download and
		   save controls off the bottom of the screen, so bound it and letterbox instead. */
		max-height: 60vh;
		object-fit: contain;
		border-radius: 2px;
	}











	/* The fixes carry no severity, so they get no tag column. */


	.page-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	/* `.download-link` lived here, styling a row of links whose text was a raw filename. The row
	   is `PageExportRow` now and owns its own styling. */

	.ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 680px) {
		.meechie {
			padding: 1.4rem 1.1rem;
		}

		.tool-tabs {
			gap: 0.35rem;
		}

		.tool-tab {
			font-size: 0.76rem;
			padding: 0.38rem 0.72rem;
		}

		.lineup-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
