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
import { postJson } from '$lib/core/http-client';
import { GenerateResultSchema } from '../../../contracts/generate.contract';
import { WigTryOnResultSchema } from '../../../contracts/wig-try-on.contract';
import {
	MeechieStudioTextResultSchema,
	type MeechieStudioTextOutput,
	type MeechieStudioVoiceSettings
} from '../../../contracts/meechie-studio-text.contract';
import type { CreationOwner, CreationRecord } from '../../../contracts/creation-store.contract';
import type { DriftDetectionOutput, Violation } from '../../../contracts/drift-detection.contract';
import type { GeneratedImage } from '../../../contracts/image-generation.contract';
import type { PackagedFile } from '../../../contracts/output-packaging.contract';
import type {
	ColoringPageSpec,
	SpecValidationOutput
} from '../../../contracts/spec-validation.contract';
import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

type PageSize = ColoringPageSpec['pageSize'];
type BorderChoice = ColoringPageSpec['border'];

// Computed once at module load; these values don't change between renders.
export const STUDIO_WEEKLY_MODES = getWeeklyModes();
export const STUDIO_MONTHLY_MODE_ID = getMonthlyMode().id;

export class StudioState {
	// --- Reactive state (template-bound) ---
	activeModeId = $state(STUDIO_WEEKLY_MODES[0].id);
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
		STUDIO_WEEKLY_MODES.find((m) => m.id === this.activeModeId) ?? STUDIO_WEEKLY_MODES[0]
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
				return `data:image/svg+xml;utf8,${encodeURIComponent(image.data)}`;
			}
			if (image.encoding === 'base64') {
				return `data:image/${image.format};base64,${image.data}`;
			}
			return '';
		})
	);
	canTryOn = $derived(!!this.selectedWigId && !!this.selfieBase64 && !this.isTryingOn);

	// --- Non-reactive implementation details ---
	owner: CreationOwner | null = null;
	authContext: CreationRecord['authContext'] | null = null;
	isBrowser = false;
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
			await creationStoreAdapter.saveDraft({
				draft: {
					updatedAtISO: new Date().toISOString(),
					intent: this.spec,
					chatMessage: this.evidence.trim().length > 0 ? this.evidence : undefined,
					studioText: this.textOutput ?? undefined
				}
			});
			this.draftSaveError = '';
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
		const validation = await specValidationAdapter.validate({ spec: this.spec });
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
		this.tryOnPortraitUrl = '';
		this.tryOnError = '';
		this.generationError = '';
		this.images = [];
		this.packagedFiles = [];
	}

	private parseTryOnPortraitImage(): GeneratedImage | null {
		const match = this.tryOnPortraitUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
		if (!match) return null;
		const mimeType = match[1];
		const subtype = match[2];
		const data = match[3];
		return {
			id: 'try-on-portrait-1',
			format: subtype === 'png' ? 'png' : 'jpg',
			mimeType,
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
		if (result.ok) {
			this.creations = result.value;
		}
	}

	// --- Public action handlers ---
	// Arrow functions ensure stable `this` binding when passed as component callbacks.

	scheduleDraftSave = (): void => {
		if (!this.isBrowser) return;
		if (this.draftTimer) clearTimeout(this.draftTimer);
		this.draftTimer = setTimeout(() => void this.saveDraft(), 300);
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

	handleDedicationInput = (event: Event): void => {
		const target = event.currentTarget as HTMLInputElement;
		this.dedication = target.value;
		this.spec = { ...this.spec, dedication: this.currentDedication() };
		void this.validateSpec();
		void this.saveDraft();
	};

	handleModeSelect = (modeId: string): void => {
		this.activeModeId = modeId;
		this.textError = '';
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
		this.isTextWorking = true;
		try {
			const trimmedEvidence = this.evidence.trim();
			const safeEvidence =
				trimmedEvidence.length > 0 || this.activeMode.toolId === 'random_meechie'
					? trimmedEvidence || 'Random Meechie line request.'
					: '';
			if (!safeEvidence) {
				this.textError = 'Meechie needs a few facts before she can call it.';
				return;
			}
			const payload = await postJson('/api/meechie-studio-text', {
				actionId: action.aiAction,
				modeId: this.activeMode.id,
				modeLabel: this.activeMode.label,
				themeLabel: this.activeTheme.label,
				evidence: safeEvidence,
				dedication: this.currentDedication(),
				voice: this.voice,
				currentText: this.currentTextPayload()
			});
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
			const payload = await postJson('/api/generate', {
				spec: this.spec,
				styleHint: this.currentStyleHint()
			});
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
				images: this.images,
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
				images: this.images,
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
		this.tryOnError = '';
		this.tryOnPortraitUrl = '';
		this.isTryingOn = true;
		try {
			const payload = await postJson('/api/wig-try-on', {
				selfieBase64: this.selfieBase64,
				selfieMimeType: this.selfieMimeType,
				wigId: this.selectedWigId
			});
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
		if (!this.owner || !this.textOutput) {
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
					intent: this.spec,
					assembledPrompt: this.assembledPrompt || this.textOutput.quote,
					studioText: this.textOutput,
					revisedPrompt: this.revisedPrompt || undefined,
					images: storedImages.length > 0 ? storedImages : undefined,
					violations: this.violations,
					fixesApplied: this.recommendedFixes.map((fix) => fix.code),
					authContext: this.authContext ?? undefined,
					owner: this.owner
				}
			});
			this.vaultStatus = result.ok ? 'Saved to the quote vault.' : result.error.message;
			await this.refreshCreations();
		} finally {
			this.isSaving = false;
		}
	};

	loadCreation = async (creation: CreationRecord): Promise<void> => {
		const restoredText = buildStudioTextFromCreationRecord(creation);
		this.spec = creation.intent;
		this.evidence = creation.studioText?.quote ?? creation.assembledPrompt;
		this.dedication = creation.intent.dedication ?? '';
		this.pageSize = creation.intent.pageSize;
		this.border = creation.intent.border;
		this.textOutput = restoredText;
		await this.validateSpec();
		this.scheduleDraftSave();
	};

	deleteCreation = async (id: string): Promise<void> => {
		const result = await creationStoreAdapter.deleteCreation({ id });
		if (result.ok) {
			await this.refreshCreations();
		}
	};

	toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		const result = await creationStoreAdapter.saveCreation({
			record: { ...creation, favorite: !creation.favorite }
		});
		if (result.ok) {
			await this.refreshCreations();
		}
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
			if (
				draft.value.studioText ||
				draft.value.intent.title !== DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle
			) {
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
