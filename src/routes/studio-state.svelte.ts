// Purpose: Svelte 5 runes state class encapsulating all Meechie Studio page logic.
// Why: Extracts the 690-line script from +page.svelte into a testable, self-contained
//      state module; the page component becomes a thin lifecycle wrapper.
// Info flow: User actions -> StudioState methods -> reactive $state updates -> component props.
import { authContextAdapter } from '$lib/adapters/auth-context.adapter';
import { creationStoreAdapter } from '$lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '$lib/adapters/session.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
import {
	DEFAULT_REVISION_BUDGET,
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText,
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
	VAULT_PREVIEW_COUNT,
	buildVaultEntries,
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
import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

type PageSize = ColoringPageSpec['pageSize'];
type BorderChoice = ColoringPageSpec['border'];

const DRAFT_SAVE_DEBOUNCE_MS = 300;

// `format` is the only image-type field the contract actually constrains: it is a closed
// four-value enum, while `mimeType` is `NonEmptyStringSchema`, so any non-empty string
// passes validation. Deriving the media type from the enum is therefore total (it can
// never emit `undefined`) and it cannot forward an unvalidated wire value. It also emits
// the registered `image/jpeg` and `image/svg+xml` names rather than the non-standard
// `image/jpg` and `image/svg` that interpolating the enum member produced.
const IMAGE_MIME_TYPES: Record<GeneratedImage['format'], string> = {
	svg: 'image/svg+xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp'
};

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
	// Delete is two-step and reversible: the first click arms `pendingDeleteId`, the second
	// removes the record but keeps it in `undoableDeletion` so one click puts it back. A saved
	// page costs a paid generation, so a single mis-tap must never be able to destroy one.
	pendingDeleteId = $state<string | null>(null);
	undoableDeletion = $state<CreationRecord | null>(null);
	// Clock reading behind the "Saved today / 3 days ago" labels. Held as state and refreshed
	// whenever the vault reloads so the labels stay a pure function of an explicit instant
	// instead of re-reading the clock inside a $derived on every keystroke.
	nowMs = $state(Date.now());

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
	imagePreviews = $derived(
		this.images.map((image) => {
			if (image.format === 'svg' && image.encoding === 'utf8') {
				return `data:${IMAGE_MIME_TYPES.svg};utf8,${encodeURIComponent(image.data)}`;
			}
			if (image.encoding === 'base64') {
				return `data:${IMAGE_MIME_TYPES[image.format]};base64,${image.data}`;
			}
			return '';
		})
	);
	canTryOn = $derived(!!this.selectedWigId && !!this.selfieBase64 && !this.isTryingOn);

	// Every saved page the current search matches, pinned first then newest first. The list used
	// to be raw store order truncated to four, so a fifth save made the first one unreachable
	// even though the store keeps fifty.
	vaultEntries = $derived(
		buildVaultEntries(this.creations, { query: this.vaultQuery, nowMs: this.nowMs })
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

	// --- Non-reactive implementation details ---
	owner: CreationOwner | null = null;
	authContext: CreationRecord['authContext'] | null = null;
	isBrowser = $state(false);
	private draftTimer: ReturnType<typeof setTimeout> | null = null;
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

	private async applyTextToSpec(output: MeechieStudioTextOutput): Promise<void> {
		this.spec = buildColoringPageSpecFromMeechieText({
			output,
			pageSize: this.pageSize,
			border: this.border,
			styleHint: this.currentStyleHint(),
			dedication: this.currentDedication()
		});
		await this.validateSpec();
		this.scheduleDraftSave();
	}

	private resetGeneratedPage(): void {
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
			mimeType: IMAGE_MIME_TYPES[format],
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
			return;
		}
		this.vaultError = '';
		this.nowMs = Date.now();
		this.creations = sortVaultCreations(result.value);
	}

	// --- Public action handlers ---
	// Arrow functions ensure stable `this` binding when passed as component callbacks.

	scheduleDraftSave = (): void => {
		if (!this.isBrowser) return;
		if (this.draftTimer) clearTimeout(this.draftTimer);
		this.draftTimer = setTimeout(() => void this.saveDraft(), DRAFT_SAVE_DEBOUNCE_MS);
	};

	syncSpecFromCurrentText = async (): Promise<void> => {
		try {
			await this.applyTextToSpec(this.textOutput ?? DEFAULT_STUDIO_TEXT_OUTPUT);
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
		}
		this.resetGeneratedPage();
		this.scheduleDraftSave();
	};

	selectWigForTryOn = async (wig: Wig): Promise<void> => {
		this.selectedWigId = wig.id;
		this.selectedWig = wig;
		this.resetTryOnResultState();
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
		this.evidence = creation.studioText?.quote ?? creation.assembledPrompt;
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
		await this.repackageRestoredImages();
		this.scheduleDraftSave();
	};

	// Rebuild the printable PDF for a reopened page so Download PDF works on it. Best effort:
	// the packaging adapter needs a browser canvas for some formats, and a page that cannot be
	// re-packaged still previews and still exports as an image, so a failure here is not an error
	// worth putting in front of the reader.
	private async repackageRestoredImages(): Promise<void> {
		if (this.images.length === 0) return;
		try {
			const packagingResult = await outputPackagingAdapter.package({
				images: $state.snapshot(this.images),
				outputFormat: 'pdf',
				fileBaseName: `meechie-coloring-page-${this.generateCreationId()}`,
				pageSize: this.spec.pageSize,
				variants: ['print']
			});
			if (packagingResult.ok) {
				this.packagedFiles = packagingResult.value.files;
			}
		} catch {
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

	destroy(): void {
		if (this.draftTimer) {
			globalThis.clearTimeout(this.draftTimer);
		}
	}
}
