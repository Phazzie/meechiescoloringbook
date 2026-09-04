// Purpose: Svelte 5 runes state class encapsulating all Meechie Studio page logic.
// Why: Extracts the 690-line script from +page.svelte into a testable, self-contained
//      state module; the page component becomes a thin lifecycle wrapper.
// Info flow: User actions -> StudioState methods -> reactive $state updates -> component props.
import { authContextAdapter } from '$lib/adapters/auth-context.adapter';
import { appOriginSeam } from '$lib/adapters/app-origin-seam';
import { clockSeam } from '$lib/adapters/clock-seam';
import { creationStoreAdapter } from '$lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
import { pageVisibilitySeam } from '$lib/adapters/page-visibility-seam';
import { sessionAdapter } from '$lib/adapters/session.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
import {
	DEFAULT_REVISION_BUDGET,
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText,
	derivesDenseDecorations,
	buildStudioTextFromCreationRecord,
	buildStudioTextFromDraftRecord,
	canRunStudioAction,
	consumeStudioActionBudget,
	getStudioTextAction,
	getMonthlyMode,
	getWeeklyModes,
	studioThemes,
	type StudioTextActionId
} from '$lib/core/meechie-studio';
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import {
	GENERATED_IMAGE_MIME_TYPES,
	generatedImageDataUrl
} from '$lib/core/generated-image-preview';
import {
	VAULT_CAPACITY,
	VAULT_PREVIEW_COUNT,
	buildVaultEntries,
	buildVaultEntry,
	restoreCreationImages,
	sortVaultCreations
} from '$lib/core/vault-gallery';
import { GenerateResultSchema } from '../../contracts/generate.contract';
import { WigTryOnResultSchema } from '../../contracts/wig-try-on.contract';
import {
	MeechieStudioTextResultSchema,
	type MeechieStudioTextOutput,
	type MeechieStudioVoiceSettings
} from '../../contracts/meechie-studio-text.contract';
import type { CreationOwner, CreationRecord } from '../../contracts/creation-store.contract';
import type { DriftDetectionOutput, Violation } from '../../contracts/drift-detection.contract';
import type { GeneratedImage } from '../../contracts/image-generation.contract';
import type { PackagedFile } from '../../contracts/output-packaging.contract';
import type {
	ColoringPageSpec,
	SpecValidationOutput
} from '../../contracts/spec-validation.contract';
import type { AppOriginSeam } from '$lib/seams/app-origin-seam/contract';
import { nextUtcDayBoundary, type ClockSeam } from '$lib/seams/clock-seam/contract';
import type { PageVisibilitySeam } from '$lib/seams/page-visibility-seam/contract';
import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

type PageSize = ColoringPageSpec['pageSize'];
type BorderChoice = ColoringPageSpec['border'];

/**
 * What caused a spec rebuild: the reader picking a theme, or anything else.
 *
 * This is not the whole answer to "should derived presentation be recomputed?" — the style hint
 * carries the voice as well as the theme, so `applyTextToSpec` also compares the hint itself. What
 * this flag adds is the one case no comparison can see: a click on the theme chip that is already
 * active leaves every value identical, and is still the reader asking for that theme.
 */
export type SettingChangeSource = 'theme' | 'setting';

const DRAFT_SAVE_DEBOUNCE_MS = 300;

type DraftSeedTextSignature = {
	title: string;
	itemLabels: readonly string[];
	footerLabel?: string;
};

const DRAFT_SEED_TEXT_SIGNATURES: readonly DraftSeedTextSignature[] = [
	{
		title: DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle,
		itemLabels: DEFAULT_STUDIO_TEXT_OUTPUT.pageItems.map((item) => item.label),
		footerLabel: DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle
	},
	{
		title: "I DON'T ACT",
		itemLabels: ['RUN THE PLACE', 'DO NOT OPEN THE DOOR', 'LOWER MY VOICE'],
		footerLabel: "I DON'T ACT"
	},
	// Shipped from the root commit 4c5660f (2026-05-10) until 05dede1 (2026-08-24)
	// replaced it with the "I DON'T ACT" seed. Drafts saved in that window still carry
	// this text, and it is seed text, not user work.
	{
		title: 'IN THIS ECONOMY',
		itemLabels: ['STAY PRETTY TOMORROW', 'CLOSE THE DOOR', 'LET THE DRAFT WORK'],
		footerLabel: 'IN THIS ECONOMY'
	}
];

const matchesDraftSeedText = (
	intent: ColoringPageSpec,
	seed: DraftSeedTextSignature
): boolean =>
	intent.title === seed.title &&
	intent.items.length === seed.itemLabels.length &&
	intent.items.every((item, index) => item.label === seed.itemLabels[index]) &&
	intent.footerItem?.label === seed.footerLabel;

const isKnownDraftSeed = (intent: ColoringPageSpec): boolean =>
	DRAFT_SEED_TEXT_SIGNATURES.some((seed) => matchesDraftSeedText(intent, seed));

export class StudioState {
	// Computed per-instance so week/month rotation stays fresh on each page mount.
	readonly weeklyModes = getWeeklyModes();
	readonly monthlyModeId = getMonthlyMode().id;

	// --- Reactive state (template-bound) ---
	activeModeId = $state(this.weeklyModes[0].id);
	selectedThemeId = $state(studioThemes[0].id);
	evidence = $state('');
	dedication = $state('');
	voice = $state<MeechieStudioVoiceSettings>({
		intensity: 'receipts_out',
		rawness: 'mild',
		thirdPerson: 'sometimes'
	});
	pageSize = $state<PageSize>('US_Letter');
	border = $state<BorderChoice>('decorative');
	glitter = $state(false);
	revisionBudget = $state(DEFAULT_REVISION_BUDGET);
	textOutput = $state<MeechieStudioTextOutput | null>(null);
	textError = $state('');
	generationError = $state('');
	draftSaveError = $state('');
	isTextWorking = $state(false);
	isGenerating = $state(false);
	copyStatus = $state('');
	vaultStatus = $state('');
	validationIssues = $state<SpecValidationOutput['issues']>([]);
	assembledPrompt = $state('');
	revisedPrompt = $state('');
	violations = $state<Violation[]>([]);
	recommendedFixes = $state<DriftDetectionOutput['recommendedFixes']>([]);
	images = $state<GeneratedImage[]>([]);
	packagedFiles = $state<PackagedFile[]>([]);
	creations = $state<CreationRecord[]>([]);
	isSaving = $state(false);

	// --- Quote Vault state ---
	vaultQuery = $state('');
	vaultShowAll = $state(false);
	vaultError = $state('');
	// True only when the last vault *read* failed, so the UI can distinguish "your pages are still
	// there, we could not see them" from any other error that happens to leave the list empty.
	vaultReadFailed = $state(false);
	// Delete is two-step and reversible: the first click arms `pendingDeleteId`, the second
	// removes the record but keeps it in `undoableDeletion` so one click puts it back. A saved
	// page costs a paid generation, so a single mis-tap must never be able to destroy one.
	pendingDeleteId = $state<string | null>(null);
	undoableDeletion = $state<CreationRecord | null>(null);
	// The clock behind the "Saved today / 3 days ago" labels. `AGENTS.md` classifies clock/time as
	// a seam, so both the reads and the day-boundary timer cross `ClockSeam` rather than calling
	// `Date.now()` or `setTimeout` here. Injectable so a test drives the rollover instead of
	// waiting for real midnight. Declared before `nowMs` so the field initializer below can use it.
	clock: ClockSeam = clockSeam;
	// Clock reading behind the labels. Held as state and refreshed at each day boundary and on each
	// vault reload, so the labels stay a pure function of an explicit instant rather than
	// re-reading the clock inside a $derived on every keystroke.
	nowMs = $state(this.clock.now());
	// Reads the origin the app is served from, used to decide whether a stored absolute image URL
	// is same-origin and therefore loadable under the app's `img-src 'self'` CSP. Behind a seam for
	// the same reason as the clock: reading `location` here would be an unseamed browser
	// integration, and the same-origin decision could not be driven from a test.
	origin: AppOriginSeam = appOriginSeam;
	// Tells the studio when a backgrounded tab comes back. Behind a seam for the same reason as the
	// clock: reading `document.visibilityState` and subscribing to `visibilitychange` here would be
	// an unseamed browser integration, reachable from a test only by dispatching a real DOM event.
	visibility: PageVisibilitySeam = pageVisibilitySeam;
	appOrigin = $state(this.origin.getOrigin());

	// --- Wig try-on state ---
	selectedWigId = $state<string | null>(null);
	selectedWig = $state<Wig | null>(null);
	selfieBase64 = $state('');
	selfieMimeType = $state<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
	isTryingOn = $state(false);
	tryOnPortraitUrl = $state('');
	tryOnError = $state('');

	// spec is initialized from literal values to avoid capturing $state references.
	// It is updated explicitly via applyTextToSpec() whenever page settings change.
	spec = $state<ColoringPageSpec>(
		buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: studioThemes[0].styleHint
		})
	);

	// --- Derived state ---
	activeMode = $derived(
		this.weeklyModes.find((m) => m.id === this.activeModeId) ?? this.weeklyModes[0]
	);
	activeTheme = $derived(
		studioThemes.find((t) => t.id === this.selectedThemeId) ?? studioThemes[0]
	);
	previewOutput = $derived(this.textOutput);
	canGenerateText = $derived(
		canRunStudioAction('generate_text', {
			remainingBudget: this.revisionBudget,
			isRunning: this.isTextWorking
		})
	);
	canRegenerateText = $derived(
		!!this.textOutput &&
			canRunStudioAction('regenerate', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakePrettier = $derived(
		!!this.textOutput &&
			canRunStudioAction('make_prettier', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakeMeaner = $derived(
		!!this.textOutput &&
			canRunStudioAction('make_meaner', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakeMoreSpecific = $derived(
		!!this.textOutput &&
			canRunStudioAction('make_more_specific', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	// `?? ''` rather than dropping the entry: this array is indexed in parallel with `images`, so
	// an unrepresentable image has to hold its slot instead of shifting every later preview onto
	// the wrong image.
	imagePreviews = $derived(
		this.images.map((image) => generatedImageDataUrl(image) ?? '')
	);
	canTryOn = $derived(!!this.selectedWigId && !!this.selfieBase64 && !this.isTryingOn);

	// Every saved page the current search matches, pinned first then newest first. The list used
	// to be raw store order truncated to four, so a fifth save made the first one unreachable
	// even though the store keeps fifty.
	vaultEntries = $derived(
		buildVaultEntries(this.creations, {
			query: this.vaultQuery,
			nowMs: this.nowMs,
			appOrigin: this.appOrigin
		})
	);
	visibleVaultEntries = $derived(
		this.vaultShowAll
			? this.vaultEntries
			: this.vaultEntries.slice(0, VAULT_PREVIEW_COUNT)
	);
	hiddenVaultCount = $derived(
		Math.max(0, this.vaultEntries.length - this.visibleVaultEntries.length)
	);
	// Keyed off the match count, not off what is currently on screen: once expanded there is
	// nothing hidden, and the toggle still has to be there to collapse the list again. It stays
	// away entirely when everything fits in the preview.
	canToggleVaultShowAll = $derived(this.vaultEntries.length > VAULT_PREVIEW_COUNT);

	// The held record rendered the same way a saved row is, so the undo banner can offer a real
	// Download for it. Without this the page waiting in Undo has no download anywhere — it is out
	// of `creations`, so no row exists — and when the vault is full `undoDelete` tells the reader
	// to "download the page you want to keep before freeing a slot" while giving them no way to do
	// it. A reload then loses the only remaining copy. Telling someone to do something the screen
	// does not let them do is the same defect this whole rebuild started from.
	undoableDeletionEntry = $derived(
		this.undoableDeletion === null
			? null
			: buildVaultEntry(this.undoableDeletion, this.nowMs, this.appOrigin)
	);

	// --- Non-reactive implementation details ---
	owner: CreationOwner | null = null;
	/**
	 * True only while the spec's layout belongs to a page reopened from the vault.
	 *
	 * The studio always authors list pages; a page saved from the Meechie tools hub can be
	 * `title_only`. That layout must survive a settings change on the reopened page, but must not
	 * outlive it: carried into a brand-new verdict it would make
	 * `buildColoringPageSpecFromMeechieText` discard every new page item, spending revision budget
	 * and image quota on an incomplete page.
	 */
	private restoredPageLayout = false;
	// Whether the last rebuild's style hint asked for dense decoration — the derivation's answer,
	// not its input. Seeded at restore time so the first unrelated setting change on a reopened page
	// compares equal and preserves what was restored.
	//
	// Comparing the whole hint string was the previous attempt and over-triggered: Rawness, Third
	// Person, Glitter and the wig all appear in the hint without governing density, so changing any
	// of them on a restored minimal page recomputed it — and with the default `receipts_out`
	// intensity the recomputation returns `dense`, so the page changed on a control that has nothing
	// to do with it.
	private lastDerivesDense: boolean | null = null;
	authContext: CreationRecord['authContext'] | null = null;
	// Incremented whenever the displayed page is replaced; async work captures it and drops its
	// result if the value moved on. Not $state: nothing renders it.
	pageLoadToken = 0;
	isBrowser = $state(false);
	private draftTimer: ReturnType<typeof setTimeout> | null = null;
	private stopVisibilityWatch: (() => void) | null = null;
	private cancelDayBoundaryRefresh: (() => void) | null = null;
	private isSavingDraft = false;
	private isDraftSavePending = false;

	// --- Private helpers ---
	private buildOwner(sessionId: string): CreationOwner {
		return { kind: 'anonymous', sessionId };
	}

	private generateCreationId(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `creation-${Date.now()}`;
	}

	private encodeBase64(value: string): string {
		const bytes = new TextEncoder().encode(value);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
	}

	private currentStyleHint(): string {
		const glitterText = this.glitter ? ' removable glitter overlay accents' : '';
		const wigText = this.selectedWig
			? ` featuring ${this.selectedWig.name} (${this.selectedWig.style})`
			: '';
		return `${this.activeTheme.styleHint}; ${this.voice.intensity}; ${this.voice.rawness}; ${this.voice.thirdPerson}${glitterText}${wigText}`;
	}

	private currentDedication(): string | undefined {
		const trimmed = this.dedication.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	private async saveDraft(): Promise<void> {
		if (this.isSavingDraft) {
			this.isDraftSavePending = true;
			return;
		}
		this.isSavingDraft = true;
		this.draftSaveError = '';
		try {
			const result = await creationStoreAdapter.saveDraft({
				draft: {
					updatedAtISO: new Date().toISOString(),
					intent: $state.snapshot(this.spec),
					chatMessage: this.evidence.trim().length > 0 ? this.evidence : undefined,
					studioText: this.textOutput ? $state.snapshot(this.textOutput) : undefined
				}
			});
			if (result.ok) {
				this.draftSaveError = '';
			} else {
				this.draftSaveError = result.error.message;
			}
		} catch (error) {
			this.draftSaveError = error instanceof Error ? error.message : 'Draft save failed';
		} finally {
			this.isSavingDraft = false;
			if (this.isDraftSavePending) {
				this.isDraftSavePending = false;
				void this.saveDraft();
			}
		}
	}

	private async validateSpec(): Promise<boolean> {
		const validation = await specValidationAdapter.validate({ spec: $state.snapshot(this.spec) });
		this.validationIssues = validation.issues;
		return validation.ok;
	}

	private async applyTextToSpec(
		output: MeechieStudioTextOutput,
		source: SettingChangeSource = 'setting'
	): Promise<void> {
		// `decorations` is derived from `styleHint.includes('receipt')`, and the style hint is the
		// theme's hint concatenated with the voice — where `receipts_out` matches. So the theme is
		// not the only control that moves the derivation, and asking only about the theme left a
		// reopened page's density stuck when the reader changed Intensity.
		//
		// Two facts decide it, each measured where it is actually knowable. The style hint *is* the
		// derivation's input, so comparing it against the last rebuild's answers "did the input
		// change?" exactly rather than by proxy — that is what comparing theme IDs was standing in
		// for, badly, three corrections running. And the panel passes `source`, because one case is
		// invisible to any comparison: clicking the theme chip that is already active leaves the
		// hint identical but is still the reader asking for that theme.
		const styleHint = this.currentStyleHint();
		const derivesDense = derivesDenseDecorations(styleHint);
		const derivationChanged = source === 'theme' || derivesDense !== this.lastDerivesDense;
		this.lastDerivesDense = derivesDense;
		this.spec = buildColoringPageSpecFromMeechieText({
			output,
			pageSize: this.pageSize,
			border: this.border,
			styleHint,
			dedication: this.currentDedication(),
			// Keep the layout only while this is still the reopened page. For anything the studio
			// authored, and for every fresh verdict, this is 'list'.
			listMode: this.restoredPageLayout ? this.spec.listMode : 'list',
			// Layout and footer are the same question — "is this still the page that was reopened?"
			// — so they read the same flag. Reading the footer off `this.spec` unconditionally
			// instead looked simpler and was wrong in one direction: once a footerless toolkit page
			// had been reopened, its missing footer outlived it. A mode change or a new verdict
			// cleared the flag but left that spec in place, so the next studio-authored list was
			// built without a footer, and every rebuild after that read the spec it had just built
			// and kept the absence forever.
			includeFooter: this.restoredPageLayout ? this.spec.footerItem !== undefined : true,
			// And the rest of the reopened page's presentation, for the same reason and off the same
			// flag. Preserving only the layout and the footer still handed back a visibly different
			// page — left-aligned, small, stroke 6 — the moment any setting changed.
			//
			// `decorations` is the one field that is derived from the theme rather than chosen, so it
			// is dropped only when the reader actually picks a theme. Every setting change comes
			// through here, so recomputing unconditionally would have turned a restored dense page
			// minimal on a page-size change alone.
			//
			// See `derivationChanged` above for why it takes both an explicit source and a direct
			// comparison of the style hint to decide this.
			presentation: this.restoredPageLayout
				? derivationChanged
					? { ...this.spec, decorations: undefined }
					: this.spec
				: undefined
		});
		await this.validateSpec();
		this.scheduleDraftSave();
	}

	private resetGeneratedPage(): void {
		// Every path that replaces what is on the paper comes through here, so this is the one
		// place the load token has to advance. Anything still in flight for the previous page
		// compares its captured token against this and discards itself.
		this.pageLoadToken += 1;
		this.generationError = '';
		this.assembledPrompt = '';
		this.revisedPrompt = '';
		this.violations = [];
		this.recommendedFixes = [];
		this.images = [];
		this.packagedFiles = [];
	}

	private resetTryOnResultState(): void {
		// Delegates to resetGeneratedPage() so a fresh try-on also clears the assembled
		// prompt/violations from any prior normal generation, not just the images/PDF —
		// System Trace renders those independently of packagedFiles/images.
		this.resetGeneratedPage();
		this.tryOnPortraitUrl = '';
		this.tryOnError = '';
	}

	private parseTryOnPortraitImage(): GeneratedImage | null {
		const match = this.tryOnPortraitUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
		if (!match) return null;
		const subtype = match[2];
		const data = match[3];
		const format = subtype === 'jpeg' ? 'jpg' : subtype;
		if (format !== 'png' && format !== 'jpg' && format !== 'webp') return null;
		// Not `match[1]`: the pattern accepts the non-standard `image/jpg` subtype, so
		// copying the incoming token verbatim would put a bogus media type on the image.
		return {
			id: 'try-on-portrait-1',
			format,
			mimeType: GENERATED_IMAGE_MIME_TYPES[format],
			data,
			encoding: 'base64'
		};
	}

	private currentTextPayload() {
		return this.textOutput
			? {
					verdict: this.textOutput.verdict,
					quote: this.textOutput.quote,
					pageTitle: this.textOutput.pageTitle,
					pageItems: this.textOutput.pageItems.map((item) => item.label),
					rating: this.textOutput.rating
				}
			: undefined;
	}

	private async refreshCreations(): Promise<void> {
		if (!this.owner) return;
		const result = await creationStoreAdapter.listCreations({ owner: this.owner });
		if (!result.ok) {
			// Reads used to fail silently, so a browser with unreadable storage showed an empty
			// vault and no reason for it. Say what happened and leave the last good list up.
			this.vaultError = result.error.message;
			// Tracked apart from `vaultError` because only a failed *read* means "your pages are
			// still there, we just could not see them". A failed write — a restore that could not
			// be saved, say — also sets `vaultError` and can also leave the list empty, and
			// telling that reader their pages could not be read would be false.
			this.vaultReadFailed = true;
			return;
		}
		this.vaultError = '';
		this.vaultReadFailed = false;
		this.nowMs = this.clock.now();
		this.creations = sortVaultCreations(result.value);
	}

	// --- Public action handlers ---
	// Arrow functions ensure stable `this` binding when passed as component callbacks.

	scheduleDraftSave = (): void => {
		if (!this.isBrowser) return;
		if (this.draftTimer) clearTimeout(this.draftTimer);
		this.draftTimer = setTimeout(() => void this.saveDraft(), DRAFT_SAVE_DEBOUNCE_MS);
	};

	syncSpecFromCurrentText = async (
		source: SettingChangeSource = 'setting'
	): Promise<void> => {
		try {
			await this.applyTextToSpec(this.textOutput ?? DEFAULT_STUDIO_TEXT_OUTPUT, source);
		} catch (error) {
			this.draftSaveError =
				error instanceof Error ? error.message : 'Page settings could not be saved.';
			throw error;
		}
	};

	handleDedicationInput = (value: string): void => {
		this.dedication = value;
		this.spec = { ...this.spec, dedication: this.currentDedication() };
		void this.validateSpec();
		this.scheduleDraftSave();
	};

	handleModeSelect = (modeId: string): void => {
		const modeChanged = modeId !== this.activeModeId;
		this.activeModeId = modeId;
		this.textError = '';
		if (modeChanged) {
			this.textOutput = null;
			this.resetGeneratedPage();
			this.restoredPageLayout = false;
		}
		this.scheduleDraftSave();
	};

	selectWigForTryOn = async (wig: Wig): Promise<void> => {
		const wigChanged = wig.id !== this.selectedWigId;
		this.selectedWigId = wig.id;
		this.selectedWig = wig;
		if (wigChanged) {
			this.resetTryOnResultState();
		}
		await this.syncSpecFromCurrentText();
	};

	setSelfieForTryOn = (
		base64: string,
		mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
	): void => {
		this.selfieBase64 = base64;
		this.selfieMimeType = mimeType;
		this.resetTryOnResultState();
	};

	runTextAction = async (actionId: StudioTextActionId): Promise<void> => {
		let action: ReturnType<typeof getStudioTextAction>;
		try {
			action = getStudioTextAction(actionId);
		} catch {
			this.textError = 'This action is not available. Try Generate Verdict instead.';
			return;
		}
		if (
			!canRunStudioAction(actionId, {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
		) {
			return;
		}
		this.textError = '';
		this.copyStatus = '';
		this.vaultStatus = '';
		const trimmedEvidence = this.evidence.trim();
		const safeEvidence =
			trimmedEvidence.length > 0 || this.activeMode.toolId === 'random_meechie'
				? trimmedEvidence || 'Random Meechie line request.'
				: '';
		if (!safeEvidence) {
			this.textError = 'Meechie needs a few facts before she can call it.';
			return;
		}

		this.isTextWorking = true;
		try {
			const payload = await postJson(
				'/api/meechie-studio-text',
				{
					actionId: action.aiAction,
					modeId: this.activeMode.id,
					modeLabel: this.activeMode.label,
					themeLabel: this.activeTheme.label,
					evidence: safeEvidence,
					dedication: this.currentDedication(),
					voice: $state.snapshot(this.voice),
					currentText: this.currentTextPayload()
				},
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.studioText }
			);
			const parsed = MeechieStudioTextResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.textError = 'Meechie sent back a line the studio could not read.';
				return;
			}
			if (!parsed.data.ok) {
				this.textError = parsed.data.error.message;
				return;
			}
			this.textOutput = parsed.data.value;
			this.revisionBudget = consumeStudioActionBudget(this.revisionBudget, actionId);
			this.resetGeneratedPage();
			// Only now, with a replacement verdict accepted, does a reopened page's layout stop
			// applying. Clearing it when the action *started* would convert the restored quote page
			// into a numbered list whenever the action then failed, timed out, or was rejected —
			// while its text was still the text on screen.
			this.restoredPageLayout = false;
			await this.applyTextToSpec(parsed.data.value);
		} catch (error) {
			this.textError =
				error instanceof Error ? error.message : 'Meechie could not reach the AI text service.';
		} finally {
			this.isTextWorking = false;
		}
	};

	handleGeneratePage = async (): Promise<void> => {
		if (!this.textOutput) {
			this.generationError = 'Generate Meechie words before creating the page.';
			return;
		}
		this.resetGeneratedPage();
		this.isGenerating = true;
		try {
			await this.applyTextToSpec(this.textOutput);
			if (this.validationIssues.length > 0) {
				this.generationError = 'Fix the page settings before generating.';
				return;
			}
			const payload = await postJson(
				'/api/generate',
				{
					spec: $state.snapshot(this.spec),
					styleHint: this.currentStyleHint()
				},
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.generate }
			);
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.generationError = 'Generate response did not match contract.';
				return;
			}
			if (!parsed.data.ok) {
				this.generationError = parsed.data.error.message;
				return;
			}
			this.assembledPrompt = parsed.data.value.prompt;
			this.images = parsed.data.value.images;
			this.revisedPrompt = parsed.data.value.revisedPrompt || '';
			this.violations = parsed.data.value.violations;
			this.recommendedFixes = parsed.data.value.recommendedFixes;

			const creationId = this.generateCreationId();
			const packagingResult = await outputPackagingAdapter.package({
				images: $state.snapshot(this.images),
				outputFormat: 'pdf',
				fileBaseName: `meechie-coloring-page-${creationId}`,
				pageSize: this.spec.pageSize,
				variants: ['print']
			});
			if (packagingResult.ok) {
				this.packagedFiles = packagingResult.value.files;
			} else {
				this.generationError = packagingResult.error.message;
			}
		} catch (error) {
			this.generationError =
				error instanceof Error ? error.message : 'Coloring page generation failed.';
		} finally {
			this.isGenerating = false;
		}
	};

	handleGenerateTryOnPage = async (): Promise<void> => {
		if (!this.tryOnPortraitUrl) {
			this.generationError = 'Create a try-on portrait first.';
			return;
		}
		this.resetGeneratedPage();
		this.isGenerating = true;
		try {
			await this.syncSpecFromCurrentText();
			const portraitImage = this.parseTryOnPortraitImage();
			if (!portraitImage) {
				this.generationError =
					'Try-on portrait format is not supported for coloring-page export.';
				return;
			}
			if (this.validationIssues.length > 0) {
				this.generationError = 'Fix the page settings before generating.';
				return;
			}
			this.images = [portraitImage];
			const creationId = this.generateCreationId();
			const packagingResult = await outputPackagingAdapter.package({
				images: $state.snapshot(this.images),
				outputFormat: 'pdf',
				fileBaseName: `meechie-try-on-coloring-page-${creationId}`,
				pageSize: this.spec.pageSize,
				variants: ['print']
			});
			if (packagingResult.ok) {
				this.packagedFiles = packagingResult.value.files;
			} else {
				this.generationError = packagingResult.error.message;
			}
		} catch (error) {
			this.generationError =
				error instanceof Error ? error.message : 'Try-on coloring page generation failed.';
		} finally {
			this.isGenerating = false;
		}
	};

	handleWigTryOn = async (): Promise<void> => {
		if (!this.selectedWigId || !this.selfieBase64) {
			this.tryOnError = 'Select a wig and upload your selfie first.';
			return;
		}
		this.resetTryOnResultState();
		this.isTryingOn = true;
		try {
			const payload = await postJson(
				'/api/wig-try-on',
				{
					selfieBase64: this.selfieBase64,
					selfieMimeType: this.selfieMimeType,
					wigId: this.selectedWigId
				},
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.wigTryOn }
			);
			const parsed = WigTryOnResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.tryOnError = 'Try-on response did not match contract.';
				return;
			}
			if (!parsed.data.ok) {
				this.tryOnError = parsed.data.error.message;
				return;
			}
			this.tryOnPortraitUrl = `data:${parsed.data.value.portraitMimeType};base64,${parsed.data.value.portraitBase64}`;
		} catch (error) {
			this.tryOnError = error instanceof Error ? error.message : 'Wig try-on failed.';
		} finally {
			this.isTryingOn = false;
		}
	};

	copyQuote = async (): Promise<void> => {
		if (!this.textOutput || !this.isBrowser) return;
		try {
			await navigator.clipboard.writeText(this.textOutput.quote);
			this.copyStatus = 'Quote copied.';
		} catch {
			this.copyStatus = 'Copy unavailable in this browser.';
		}
	};

	saveToVault = async (): Promise<void> => {
		if (this.isSaving) return;
		const owner = this.owner;
		const textOutput = this.textOutput;
		if (!owner || !textOutput) {
			this.vaultStatus = 'Session is still connecting. Try again in a moment.';
			return;
		}
		this.isSaving = true;
		this.vaultStatus = 'Saving...';
		const creationId = this.generateCreationId();
		const storedImages = this.images.map((image) => ({
			b64: image.encoding === 'base64' ? image.data : this.encodeBase64(image.data)
		}));
		try {
			const result = await creationStoreAdapter.saveCreation({
				record: {
					id: creationId,
					createdAtISO: new Date().toISOString(),
					intent: $state.snapshot(this.spec),
					assembledPrompt: this.assembledPrompt || textOutput.quote,
					studioText: $state.snapshot(textOutput),
					revisedPrompt: this.revisedPrompt || undefined,
					images: storedImages.length > 0 ? storedImages : undefined,
					violations: $state.snapshot(this.violations),
					fixesApplied: this.recommendedFixes.map((fix) => fix.code),
					authContext: this.authContext ?? undefined,
					owner
				}
			});
			this.vaultStatus = result.ok ? 'Saved to the quote vault.' : result.error.message;
			await this.refreshCreations();
		} catch (error) {
			this.vaultStatus = error instanceof Error ? error.message : 'Failed to save to vault.';
		} finally {
			this.isSaving = false;
		}
	};

	loadCreation = async (creation: CreationRecord): Promise<void> => {
		const restoredText = buildStudioTextFromCreationRecord(creation);
		this.resetGeneratedPage();
		this.spec = creation.intent;
		// This page's layout is the saved page's, not the studio's, until a new verdict replaces it.
		this.restoredPageLayout = true;
		// Seed the derivation input at restore time, so the first setting change that does not touch
		// it compares equal and keeps the density the saved page was built with.
		this.lastDerivesDense = derivesDenseDecorations(this.currentStyleHint());
		// The evidence box is an editable field the reader's next Generate Verdict sends to the text
		// provider as their own words, so what lands in it matters more than a display string does.
		// This fell back to `assembledPrompt` — the image-generation prompt — for any record saved
		// without studio text, which put `STYLE: bold outline art / NEGATIVE PROMPT: ...` in the box
		// and shipped those machine instructions to the provider as user facts on the next click.
		// `restoredText` already resolves the same `studioText.quote` when it exists and the page's
		// own words when it does not, so read it from there and never from the prompt.
		this.evidence = restoredText.quote;
		this.dedication = creation.intent.dedication ?? '';
		this.pageSize = creation.intent.pageSize;
		this.border = creation.intent.border;
		this.textOutput = restoredText;
		// Reopening a saved page used to hand back the words and drop the picture, so the only
		// way to see your own page again was to pay for another generation. The record already
		// carries the image bytes and the trace, so give all of it back.
		this.images = restoreCreationImages(creation);
		this.assembledPrompt = creation.assembledPrompt;
		this.revisedPrompt = creation.revisedPrompt ?? '';
		this.violations = creation.violations ?? [];
		this.vaultStatus = `Reopened "${creation.intent.title}".`;
		await this.validateSpec();
		await this.repackageRestoredImages(this.pageLoadToken);
		this.scheduleDraftSave();
	};

	// Rebuild the printable PDF for a reopened page so Download PDF works on it. Best effort:
	// the packaging adapter needs a browser canvas for some formats, and a page that cannot be
	// re-packaged still previews and still exports as an image, so a failure here is not an error
	// worth putting in front of the reader.
	private async repackageRestoredImages(loadToken: number): Promise<void> {
		if (this.images.length === 0) return;
		try {
			const packagingResult = await outputPackagingAdapter.package({
				images: $state.snapshot(this.images),
				outputFormat: 'pdf',
				fileBaseName: `meechie-coloring-page-${this.generateCreationId()}`,
				pageSize: this.spec.pageSize,
				variants: ['print']
			});
			// Packaging is slow enough that the reader can open another page, or start a new
			// generation, while it runs. Without this guard the late result would attach the
			// previous page's PDF to whatever is on screen now, so Download PDF would hand back a
			// different page than the one displayed.
			if (loadToken !== this.pageLoadToken) return;
			if (packagingResult.ok) {
				this.packagedFiles = packagingResult.value.files;
			}
		} catch {
			if (loadToken !== this.pageLoadToken) return;
			this.packagedFiles = [];
		}
	}

	setVaultQuery = (value: string): void => {
		this.vaultQuery = value;
		// A search that hides the armed row would otherwise leave a delete primed off-screen.
		this.pendingDeleteId = null;
	};

	toggleVaultShowAll = (): void => {
		this.vaultShowAll = !this.vaultShowAll;
		// Collapsing can hide the armed row exactly as a search can, and an armed delete left
		// off-screen would still be primed when the list is expanded again.
		this.pendingDeleteId = null;
	};

	requestDeleteCreation = (id: string): void => {
		this.pendingDeleteId = id;
		this.vaultError = '';
	};

	cancelDeleteCreation = (): void => {
		this.pendingDeleteId = null;
	};

	deleteCreation = async (id: string): Promise<void> => {
		const removed = this.creations.find((creation) => creation.id === id) ?? null;
		const result = await creationStoreAdapter.deleteCreation({ id });
		this.pendingDeleteId = null;
		if (!result.ok) {
			this.vaultError = result.error.message;
			return;
		}
		this.vaultError = '';
		// Keep a full copy so Undo can put the exact record back, not a reconstruction of it.
		this.undoableDeletion = removed ? $state.snapshot(removed) : null;
		this.vaultStatus = removed
			? `Deleted "${removed.intent.title}".`
			: 'Deleted.';
		await this.refreshCreations();
	};

	undoDelete = async (): Promise<void> => {
		const record = this.undoableDeletion;
		if (!record) return;
		// The store keeps a fixed number of records and drops the oldest past that. If the slot
		// freed by the delete has since been taken by a new save, restoring would push the list
		// back over the cap and silently evict another page — the exact failure this whole feature
		// exists to stop — while reporting only that this one came back. Refuse, and say why,
		// rather than trading one lost page for another.
		//
		// This is a lower bound, not a store-wide guarantee. `creations` holds only the records
		// matching the current owner, while the adapter applies its cap to the whole stored array.
		// The two agree while `cb_session_id_v1` survives, since `buildOwner` derives the single
		// owner from it; records orphaned under a previous session id still occupy slots this
		// count cannot see. Closing that gap means deciding capacity inside `CreationStoreSeam` or
		// exposing it through the contract — a contract change, and so the full Seam-Driven
		// Development workflow. It is tracked with the other deferred seam work in
		// `WORST_TO_BEST_LOG.md` rather than widened into this fix.
		if (this.creations.length >= VAULT_CAPACITY) {
			// Deliberately does not say "delete a page, then undo". `deleteCreation` replaces
			// `undoableDeletion` with whatever was deleted last, so following that instruction
			// would discard this record and leave Undo holding the page just deleted to make room
			// for it. Say what is true, and what it costs, instead of scripting a move that
			// destroys the thing the reader is trying to save.
			this.vaultError =
				`The vault is full at ${VAULT_CAPACITY} pages, so "${record.intent.title}" cannot ` +
				'come back without pushing another page out. It is still held here for now — but ' +
				'Undo only ever holds the most recent deletion, so deleting another page to make ' +
				'room would replace it. Download the page you want to keep before freeing a slot.';
			return;
		}
		const result = await creationStoreAdapter.saveCreation({ record });
		if (!result.ok) {
			this.vaultError = result.error.message;
			return;
		}
		this.vaultError = '';
		this.undoableDeletion = null;
		this.vaultStatus = `Restored "${record.intent.title}".`;
		await this.refreshCreations();
	};

	dismissUndoDelete = (): void => {
		this.undoableDeletion = null;
	};

	toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		const result = await creationStoreAdapter.saveCreation({
			record: { ...$state.snapshot(creation), favorite: !creation.favorite }
		});
		if (!result.ok) {
			this.vaultError = result.error.message;
			return;
		}
		this.vaultError = '';
		await this.refreshCreations();
	};

	// --- Lifecycle ---

	async init(): Promise<void> {
		this.isBrowser = true;
		// Re-read rather than trusting the field initializer: a test or an alternate host may have
		// replaced `origin` after construction, and the value captured then would be the default
		// adapter's. The clock and visibility seams are consulted here for the same reason.
		this.appOrigin = this.origin.getOrigin();
		this.startSavedLabelRefresh();
		const [sessionResult, draft] = await Promise.all([
			sessionAdapter.getSession(),
			creationStoreAdapter.getDraft({})
		]);
		if (sessionResult.ok) {
			this.owner = this.buildOwner(sessionResult.value.sessionId);
			const authResult = await authContextAdapter.getAuthContext({
				sessionId: sessionResult.value.sessionId
			});
			if (authResult.ok) {
				this.authContext = authResult.value;
			}
		}
		if (draft.ok && draft.value) {
			this.spec = draft.value.intent;
			// A persisted spec carries its own provenance, exactly as `loadCreation` treats one it
			// reads from the vault — so this is unconditionally true, for the same reason that one
			// is. Deriving it from `listMode === 'title_only'` recognised only reopened *quote*
			// pages and missed reopened structured toolkit pages, which are footerless `list`s.
			// Setting it for a studio-authored draft costs nothing: such a spec is a `list` with a
			// footer, so both derivations above return what the false branch would have.
			this.restoredPageLayout = true;
			this.lastDerivesDense = derivesDenseDecorations(this.currentStyleHint());
			this.evidence = draft.value.chatMessage || '';
			this.dedication = draft.value.intent.dedication ?? '';
			this.pageSize = draft.value.intent.pageSize;
			this.border = draft.value.intent.border;
			if (draft.value.studioText || !isKnownDraftSeed(draft.value.intent)) {
				this.textOutput = buildStudioTextFromDraftRecord(draft.value);
			}
		}
		await this.validateSpec();
		await this.refreshCreations();
	}

	// "Saved today" is computed against `nowMs`, which otherwise only advances when the vault is
	// read or written, so a studio left open across UTC midnight keeps showing yesterday's labels.
	// Two things move the clock forward, because the two cases are genuinely different:
	//
	//   - A timer armed at the next UTC day boundary, which re-arms itself for the boundary after
	//     that. This is the case that matters most: a reader who leaves the tab in the foreground
	//     is looking straight at the labels while they go stale, and no event would ever fire.
	//   - `visibilitychange`, for the tab that was suspended in the background. A backgrounded
	//     timer can be throttled or deferred, so the boundary timer alone cannot be relied on to
	//     have fired on time; reading the clock on the way back in fixes the label immediately.
	private startSavedLabelRefresh(): void {
		this.scheduleNextDayBoundaryRefresh();
		this.stopVisibilityWatch = this.visibility.onVisible(() => {
			this.nowMs = this.clock.now();
			// The boundary the old timer was waiting for may already be behind us.
			this.scheduleNextDayBoundaryRefresh();
		});
	}

	private scheduleNextDayBoundaryRefresh(): void {
		this.cancelDayBoundaryRefresh?.();
		this.cancelDayBoundaryRefresh = this.clock.scheduleAt(
			nextUtcDayBoundary(this.clock.now()),
			() => {
				this.nowMs = this.clock.now();
				this.scheduleNextDayBoundaryRefresh();
			}
		);
	}

	destroy(): void {
		if (this.draftTimer) {
			globalThis.clearTimeout(this.draftTimer);
		}
		this.cancelDayBoundaryRefresh?.();
		this.cancelDayBoundaryRefresh = null;
		this.stopVisibilityWatch?.();
		this.stopVisibilityWatch = null;
	}
}
