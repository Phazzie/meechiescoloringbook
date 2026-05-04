<!--
Purpose: Main Meechie coloring-page studio.
Why: Generate AI-backed Meechie wording and printable coloring pages with cost-aware controls.
Info flow: User evidence -> MeechieStudioTextSeam -> page spec -> image/package/store seams.
-->
<script lang="ts">
	import { onMount } from 'svelte';
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
		getStudioAction,
		studioModes,
		studioThemes,
		type StudioActionId
	} from '$lib/core/meechie-studio';
	import { postJson } from '$lib/core/http-client';
	import { GenerateResultSchema } from '../../contracts/generate.contract';
	import {
		MeechieStudioTextResultSchema,
		type MeechieStudioTextOutput,
		type MeechieStudioVoiceSettings
	} from '../../contracts/meechie-studio-text.contract';
	import type { CreationOwner, CreationRecord } from '../../contracts/creation-store.contract';
	import type { DriftDetectionOutput, Violation } from '../../contracts/drift-detection.contract';
	import type { GeneratedImage } from '../../contracts/image-generation.contract';
	import type { PackagedFile } from '../../contracts/output-packaging.contract';
	import type { ColoringPageSpec, SpecValidationOutput } from '../../contracts/spec-validation.contract';

	type PageSize = ColoringPageSpec['pageSize'];
	type BorderChoice = ColoringPageSpec['border'];

	let activeModeId = studioModes[0].id;
	let selectedThemeId = studioThemes[0].id;
	let evidence = '';
	let dedication = '';
	let voice: MeechieStudioVoiceSettings = {
		intensity: 'receipts_out',
		rawness: 'mild',
		thirdPerson: 'sometimes'
	};
	let pageSize: PageSize = 'US_Letter';
	let border: BorderChoice = 'decorative';
	let glitter = false;
	let revisionBudget = DEFAULT_REVISION_BUDGET;
	let textOutput: MeechieStudioTextOutput | null = null;
	let textError = '';
	let generationError = '';
	let isTextWorking = false;
	let isGenerating = false;
	let copyStatus = '';
	let vaultStatus = '';
	let validationIssues: SpecValidationOutput['issues'] = [];
	let assembledPrompt = '';
	let revisedPrompt = '';
	let violations: Violation[] = [];
	let recommendedFixes: DriftDetectionOutput['recommendedFixes'] = [];
	let images: GeneratedImage[] = [];
	let imagePreviews: string[] = [];
	let packagedFiles: PackagedFile[] = [];
	let creations: CreationRecord[] = [];
	let owner: CreationOwner | null = null;
	let authContext: CreationRecord['authContext'] | null = null;
	let isBrowser = false;
	let draftTimer: ReturnType<typeof setTimeout> | null = null;
	let canGenerateText = true;
	let canRegenerateText = false;
	let canMakePrettier = false;
	let canMakeMeaner = false;
	let canMakeMoreSpecific = false;

	const activeMode = () => studioModes.find((mode) => mode.id === activeModeId) ?? studioModes[0];
	const activeTheme = () =>
		studioThemes.find((theme) => theme.id === selectedThemeId) ?? studioThemes[0];

	let spec: ColoringPageSpec = buildColoringPageSpecFromMeechieText({
		output: DEFAULT_STUDIO_TEXT_OUTPUT,
		pageSize,
		border,
		styleHint: activeTheme().styleHint
	});

	$: previewOutput = textOutput ?? DEFAULT_STUDIO_TEXT_OUTPUT;

	const buildOwner = (sessionId: string): CreationOwner => ({
		kind: 'anonymous',
		sessionId
	});

	const generateCreationId = (): string => {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `creation-${Date.now()}`;
	};

	const encodeBase64 = (value: string): string => {
		const bytes = new TextEncoder().encode(value);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
	};

	const currentStyleHint = (): string => {
		const glitterText = glitter ? ' removable glitter overlay accents' : '';
		return `${activeTheme().styleHint}; ${voice.intensity}; ${voice.rawness}; ${voice.thirdPerson}${glitterText}`;
	};

	const scheduleDraftSave = (): void => {
		if (!isBrowser) {
			return;
		}
		if (draftTimer) {
			clearTimeout(draftTimer);
		}
		draftTimer = setTimeout(() => {
			void saveDraft();
		}, 300);
	};

	let isSavingDraft = false;
	const saveDraft = async (): Promise<void> => {
		if (isSavingDraft) return;
		isSavingDraft = true;
		try {
			await creationStoreAdapter.saveDraft({
			draft: {
				updatedAtISO: new Date().toISOString(),
				intent: spec,
				chatMessage: evidence.trim().length > 0 ? evidence : undefined,
				studioText: textOutput ?? undefined
			}
		});
		} finally {
			isSavingDraft = false;
		}
	};

	const validateSpec = async (): Promise<boolean> => {
		const validation = await specValidationAdapter.validate({ spec });
		validationIssues = validation.issues;
		return validation.ok;
	};

	const applyTextToSpec = async (output: MeechieStudioTextOutput): Promise<void> => {
		spec = buildColoringPageSpecFromMeechieText({
			output,
			pageSize,
			border,
			styleHint: currentStyleHint(),
			dedication: dedication.trim().length > 0 ? dedication : undefined
		});
		await validateSpec();
		scheduleDraftSave();
	};

	const resetGeneratedPage = (): void => {
		generationError = '';
		assembledPrompt = '';
		revisedPrompt = '';
		violations = [];
		recommendedFixes = [];
		images = [];
		packagedFiles = [];
	};

	const canRunAction = (actionId: StudioActionId): boolean =>
		canRunStudioAction(actionId, { remainingBudget: revisionBudget, isRunning: isTextWorking });

	const currentTextPayload = () =>
		textOutput
			? {
					verdict: textOutput.verdict,
					quote: textOutput.quote,
					pageTitle: textOutput.pageTitle,
					pageItems: textOutput.pageItems.map((item) => item.label),
					rating: textOutput.rating
				}
			: undefined;

	const runTextAction = async (actionId: StudioActionId): Promise<void> => {
		const action = getStudioAction(actionId);
		if (!action.aiAction || !canRunAction(actionId)) {
			return;
		}
		textError = '';
		copyStatus = '';
		vaultStatus = '';
		isTextWorking = true;
		try {
			const trimmedEvidence = evidence.trim();
			const safeEvidence =
				trimmedEvidence.length > 0 || activeMode().toolId === 'random_meechie'
					? trimmedEvidence || 'Random Meechie line request.'
					: '';
			if (!safeEvidence) {
				textError = 'Meechie needs a few facts before she can call it.';
				return;
			}

			const { payload } = await postJson('/api/meechie-studio-text', {
				actionId: action.aiAction,
				modeId: activeMode().id,
				modeLabel: activeMode().label,
				themeLabel: activeTheme().label,
				evidence: safeEvidence,
				dedication: dedication.trim().length > 0 ? dedication.trim() : undefined,
				voice,
				currentText: currentTextPayload()
			});
			const parsed = MeechieStudioTextResultSchema.safeParse(payload);
			if (!parsed.success) {
				textError = 'Meechie sent back a line the studio could not read.';
				return;
			}
			if (!parsed.data.ok) {
				textError = parsed.data.error.message;
				return;
			}
			textOutput = parsed.data.value;
			revisionBudget = consumeStudioActionBudget(revisionBudget, actionId);
			resetGeneratedPage();
			await applyTextToSpec(parsed.data.value);
		} catch (error) {
			textError = error instanceof Error ? error.message : 'Meechie could not reach the AI text service.';
		} finally {
			isTextWorking = false;
		}
	};

	const handleGeneratePage = async (): Promise<void> => {
		if (!textOutput) {
			generationError = 'Generate Meechie words before creating the page.';
			return;
		}
		resetGeneratedPage();
		isGenerating = true;
		try {
			await applyTextToSpec(textOutput);
			const valid = await validateSpec();
			if (!valid) {
				generationError = 'Fix the page settings before generating.';
				return;
			}
			const { payload } = await postJson('/api/generate', {
				spec,
				styleHint: currentStyleHint()
			});
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				generationError = 'Generate response did not match contract.';
				return;
			}
			if (!parsed.data.ok) {
				generationError = parsed.data.error.message;
				return;
			}
			assembledPrompt = parsed.data.value.prompt;
			images = parsed.data.value.images;
			revisedPrompt = parsed.data.value.revisedPrompt || '';
			violations = parsed.data.value.violations;
			recommendedFixes = parsed.data.value.recommendedFixes;

			const creationId = generateCreationId();
			const packagingResult = await outputPackagingAdapter.package({
				images,
				outputFormat: 'pdf',
				fileBaseName: `meechie-coloring-page-${creationId}`,
				pageSize: spec.pageSize,
				variants: ['print']
			});
			if (packagingResult.ok) {
				packagedFiles = packagingResult.value.files;
			} else {
				generationError = packagingResult.error.message;
			}
		} catch (error) {
			generationError = error instanceof Error ? error.message : 'Coloring page generation failed.';
		} finally {
			isGenerating = false;
		}
	};

	const copyQuote = async (): Promise<void> => {
		if (!textOutput || !isBrowser) {
			return;
		}
		await navigator.clipboard.writeText(textOutput.quote);
		copyStatus = 'Quote copied.';
	};

	let isSaving = false;
	const saveToVault = async (): Promise<void> => {
		if (isSaving) return;
		if (!owner || !textOutput) {
			vaultStatus = 'Session is still connecting. Try again in a moment.';
			return;
		}
		isSaving = true;
		vaultStatus = 'Saving...';
		const creationId = generateCreationId();
		const storedImages = images.map((image) => ({
			b64: image.encoding === 'base64' ? image.data : encodeBase64(image.data)
		}));
		try {
			const result = await creationStoreAdapter.saveCreation({
			record: {
				id: creationId,
				createdAtISO: new Date().toISOString(),
				intent: spec,
				assembledPrompt: assembledPrompt || textOutput.quote,
				studioText: textOutput,
				revisedPrompt,
				images: storedImages.length > 0 ? storedImages : undefined,
				violations,
				fixesApplied: recommendedFixes.map((fix) => fix.code),
				authContext: authContext ?? undefined,
				owner
			}
		});
		vaultStatus = result.ok ? 'Saved to the quote vault.' : result.error.message;
		await refreshCreations();
		} finally {
			isSaving = false;
		}
	};

	const refreshCreations = async (): Promise<void> => {
		if (!owner) {
			return;
		}
		const result = await creationStoreAdapter.listCreations({ owner });
		if (result.ok) {
			creations = result.value;
		}
	};

	const loadCreation = async (creation: CreationRecord): Promise<void> => {
		const restoredText = buildStudioTextFromCreationRecord(creation);
		spec = creation.intent;
		evidence = creation.studioText?.quote ?? creation.assembledPrompt;
		dedication = creation.intent.dedication ?? '';
		pageSize = creation.intent.pageSize;
		border = creation.intent.border;
		textOutput = restoredText;
		await validateSpec();
	};

	const deleteCreation = async (id: string): Promise<void> => {
		const result = await creationStoreAdapter.deleteCreation({ id });
		if (result.ok) {
			await refreshCreations();
		}
	};

	const toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		const result = await creationStoreAdapter.saveCreation({
			record: { ...creation, favorite: !creation.favorite }
		});
		if (result.ok) {
			await refreshCreations();
		}
	};

	$: canGenerateText = canRunStudioAction('generate_text', {
		remainingBudget: revisionBudget,
		isRunning: isTextWorking
	});
	$: canRegenerateText =
		!!textOutput &&
		canRunStudioAction('regenerate', { remainingBudget: revisionBudget, isRunning: isTextWorking });
	$: canMakePrettier =
		!!textOutput &&
		canRunStudioAction('make_prettier', {
			remainingBudget: revisionBudget,
			isRunning: isTextWorking
		});
	$: canMakeMeaner =
		!!textOutput &&
		canRunStudioAction('make_meaner', { remainingBudget: revisionBudget, isRunning: isTextWorking });
	$: canMakeMoreSpecific =
		!!textOutput &&
		canRunStudioAction('make_more_specific', {
			remainingBudget: revisionBudget,
			isRunning: isTextWorking
		});

	$: imagePreviews = images.map((image) => {
		if (image.format === 'svg' && image.encoding === 'utf8') {
			return `data:image/svg+xml;utf8,${encodeURIComponent(image.data)}`;
		}
		if (image.encoding === 'base64') {
			return `data:image/${image.format};base64,${image.data}`;
		}
		return '';
	});

	onMount(async () => {
		isBrowser = true;
		const sessionResult = await sessionAdapter.getSession();
		if (sessionResult.ok) {
			owner = buildOwner(sessionResult.value.sessionId);
			const authResult = await authContextAdapter.getAuthContext({
				sessionId: sessionResult.value.sessionId
			});
			if (authResult.ok) {
				authContext = authResult.value;
			}
		}
		const draft = await creationStoreAdapter.getDraft({});
		if (draft.ok && draft.value) {
			spec = draft.value.intent;
			evidence = draft.value.chatMessage || '';
			dedication = draft.value.intent.dedication ?? '';
			pageSize = draft.value.intent.pageSize;
			border = draft.value.intent.border;
			if (draft.value.studioText || draft.value.intent.title !== DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle) {
				textOutput = buildStudioTextFromDraftRecord(draft.value);
			}
		}
		await validateSpec();
		await refreshCreations();
	});
</script>

<svelte:head>
	<title>Meechies Coloring Book Studio</title>
</svelte:head>

<main class="studio">
	<section class="hero" style={`background-image: linear-gradient(90deg, rgba(7, 7, 15, 0.94), rgba(7, 7, 15, 0.62)), url('/meechie/meechie-banner.png');`}>
		<div class="hero-copy">
			<p class="eyebrow">Meechies Coloring Book Generator</p>
			<h1>Meechies Coloring Book</h1>
			<p>
				Tell Meechie what happened, get the verdict and quote, then turn it into a printable
				coloring page.
			</p>
			<button type="button" class="primary" on:click={() => runTextAction('generate_text')} disabled={!canGenerateText}>
				{isTextWorking ? 'Reading...' : activeMode().cta}
			</button>
		</div>
	</section>

	<section class="mode-strip" aria-label="Choose a Meechie mode">
		{#each studioModes as mode}
			<button
				type="button"
				class="mode-card"
				class:active={activeModeId === mode.id}
				style={`--mode-color: ${mode.themeColor}; --mode-image: url('${mode.image}')`}
				on:click={() => {
					activeModeId = mode.id;
					textError = '';
					resetGeneratedPage();
					scheduleDraftSave();
				}}
			>
				<span class="mode-icon">{mode.icon}</span>
				<span class="mode-label">{mode.label}</span>
				<span class="mode-help">{mode.help}</span>
			</button>
		{/each}
	</section>

	<section class="workbench">
		<div class="input-panel">
			<div class="panel-head">
				<p class="eyebrow">Evidence</p>
				<h2>{activeMode().label}</h2>
				<p>{activeMode().help}</p>
			</div>

			<label for="evidence">What happened?</label>
			<textarea
				id="evidence"
				rows="8"
				bind:value={evidence}
				on:input={scheduleDraftSave}
				placeholder={activeMode().placeholder}
			></textarea>

			<label for="dedication">Shoutout</label>
			<input
				id="dedication"
				bind:value={dedication}
				on:input={scheduleDraftSave}
				maxlength="60"
				placeholder="Optional dedication"
			/>

			<div class="budget">
				<span>{revisionBudget} AI text actions left</span>
				{#if revisionBudget === 0}
					<p>You used the wording changes for this page. Export, copy, theme, and vault still work.</p>
				{/if}
			</div>

			<div class="ai-actions">
				<button type="button" class="primary" on:click={() => runTextAction('generate_text')} disabled={!canGenerateText}>
					{isTextWorking ? 'Reading...' : getStudioAction('generate_text').label}
				</button>
				<button type="button" on:click={() => runTextAction('regenerate')} disabled={!canRegenerateText}>
					{getStudioAction('regenerate').label}
				</button>
				<button type="button" on:click={() => runTextAction('make_prettier')} disabled={!canMakePrettier}>
					{getStudioAction('make_prettier').label}
				</button>
				<button type="button" on:click={() => runTextAction('make_meaner')} disabled={!canMakeMeaner}>
					{getStudioAction('make_meaner').label}
				</button>
				<button type="button" on:click={() => runTextAction('make_more_specific')} disabled={!canMakeMoreSpecific}>
					{getStudioAction('make_more_specific').label}
				</button>
			</div>

			{#if textError}
				<p class="error">{textError}</p>
			{/if}
		</div>

		<section class="preview-panel" aria-label="Meechie coloring-page preview">
			<div class="preview-head">
				<div>
					<p class="eyebrow">Preview</p>
					<h2>{previewOutput.pageTitle}</h2>
				</div>
				<img src={activeTheme().image} alt="" />
			</div>

			<div class="paper" class:glitter>
				{#if imagePreviews.length > 0}
					<img class="generated-image" src={imagePreviews[0]} alt="Generated Meechie coloring page" />
				{:else}
					<div class="paper-empty">
						<p class="paper-title">{previewOutput.pageTitle}</p>
						<ol>
							{#each previewOutput.pageItems as item}
								<li>{item.label}</li>
							{/each}
						</ol>
						<p class="paper-quote">"{previewOutput.quote}"</p>
					</div>
				{/if}
			</div>

			{#if generationError}
				<p class="error">{generationError}</p>
			{/if}

			<div class="preview-actions">
				<button type="button" class="primary" on:click={handleGeneratePage} disabled={!textOutput || isGenerating}>
					{isGenerating ? 'Creating...' : 'Create Coloring Page'}
				</button>
				{#if packagedFiles.length > 0}
					{#each packagedFiles as file}
						<a class="button-link" href={`data:${file.mimeType};base64,${file.dataBase64}`} download={file.filename}>
							{getStudioAction('download_pdf').label}
						</a>
					{/each}
				{:else}
					<button type="button" disabled>{getStudioAction('download_pdf').label}</button>
				{/if}
				{#if imagePreviews[0]}
					<a class="button-link" href={imagePreviews[0]} download="meechie-coloring-page.png">
						{getStudioAction('export_png').label}
					</a>
				{:else}
					<button type="button" disabled>{getStudioAction('export_png').label}</button>
				{/if}
				<button type="button" on:click={copyQuote} disabled={!textOutput}>{getStudioAction('copy_quote').label}</button>
				<button type="button" on:click={saveToVault} disabled={!textOutput || isSaving}>{getStudioAction('save_to_vault').label}</button>
			</div>

			{#if copyStatus || vaultStatus}
				<p class="status">{copyStatus || vaultStatus}</p>
			{/if}
		</section>

		<details class="settings-panel">
			<summary>
				<span>
					<span class="eyebrow">Settings</span>
					<strong>Page Controls</strong>
				</span>
				<span aria-hidden="true">Open</span>
			</summary>

			<div class="settings-content">
				<div class="theme-grid" aria-label="Theme options">
					{#each studioThemes as theme}
						<button
							type="button"
							class="theme-chip"
							class:active={selectedThemeId === theme.id}
							on:click={() => {
								selectedThemeId = theme.id;
								if (textOutput) {
									void applyTextToSpec(textOutput);
								}
							}}
						>
							<span>{theme.icon}</span>
							{theme.label}
						</button>
					{/each}
				</div>

				<label for="intensity">Intensity</label>
				<select id="intensity" bind:value={voice.intensity}>
					<option value="receipts_out">Receipts Out</option>
					<option value="church_lady">Church Lady</option>
					<option value="no_mercy">No Mercy</option>
				</select>

				<label for="rawness">Rawness</label>
				<select id="rawness" bind:value={voice.rawness}>
					<option value="mild">Mild</option>
					<option value="medium">Medium</option>
					<option value="raw">Raw</option>
				</select>

				<label for="thirdPerson">Third Person</label>
				<select id="thirdPerson" bind:value={voice.thirdPerson}>
					<option value="sometimes">Sometimes</option>
					<option value="always">Always</option>
					<option value="never">Never</option>
				</select>

				<label for="pageSize">Page Size</label>
				<select
					id="pageSize"
					bind:value={pageSize}
					on:change={() => textOutput && applyTextToSpec(textOutput)}
				>
					<option value="US_Letter">US Letter</option>
					<option value="A4">A4</option>
				</select>

				<label for="border">Border</label>
				<select
					id="border"
					bind:value={border}
					on:change={() => textOutput && applyTextToSpec(textOutput)}
				>
					<option value="decorative">Decorative</option>
					<option value="plain">Plain</option>
					<option value="none">None</option>
				</select>

				<label class="toggle">
					<input type="checkbox" bind:checked={glitter} />
					<span>Add glitter overlay</span>
				</label>
			</div>
		</details>
	</section>

	<section class="verdict-row">
		<article class="verdict-card">
			<p class="eyebrow">Verdict</p>
			<h2>{textOutput?.verdict ?? 'No verdict yet.'}</h2>
			<p>{textOutput?.quote ?? 'Meechie will put the quote here after the AI text action runs.'}</p>
			{#if textOutput?.rating}
				<span class="rating">{textOutput.rating}/10</span>
			{/if}
		</article>
		<article class="vault-card">
			<p class="eyebrow">Quote Vault</p>
			<h2>Saved Pages</h2>
			{#if creations.length === 0}
				<p>No saved pages yet.</p>
			{:else}
				<div class="vault-list">
					{#each creations.slice(0, 4) as creation}
						<div class="vault-item">
							<button type="button" on:click={() => loadCreation(creation)}>{creation.intent.title}</button>
							<div>
								<button type="button" on:click={() => toggleFavorite(creation)}>
									{creation.favorite ? 'Unpin' : 'Pin'}
								</button>
								<button type="button" on:click={() => deleteCreation(creation.id)}>Delete</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</article>
	</section>

	<details class="diagnostics">
		<summary>System Trace</summary>
		<div class="diagnostics-grid">
			<label>
				Prompt
				<textarea rows="6" readonly value={assembledPrompt}></textarea>
			</label>
			<label>
				Model Rewrite
				<textarea rows="6" readonly value={revisedPrompt}></textarea>
			</label>
			<div>
				<p class="eyebrow">Quality</p>
				{#if validationIssues.length === 0 && violations.length === 0}
					<p>No quality flags.</p>
				{:else}
					<ul>
						{#each validationIssues as issue}
							<li>{issue.field}: {issue.message}</li>
						{/each}
						{#each violations as violation}
							<li>{violation.code}: {violation.message}</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</details>
</main>

<style>
	.studio {
		max-width: 1240px;
		margin: 0 auto;
		padding: 1.4rem;
		color: var(--cream);
	}

	.hero {
		width: 100vw;
		min-height: clamp(420px, 46vw, 560px);
		display: grid;
		grid-template-columns: minmax(0, 0.44fr) minmax(0, 0.56fr);
		align-items: flex-end;
		box-sizing: border-box;
		margin-left: calc(50% - 50vw);
		margin-right: calc(50% - 50vw);
		padding: clamp(1.4rem, 4vw, 3rem) max(1.4rem, calc((100vw - 1240px) / 2 + 1.4rem));
		border-top: 1px solid rgba(201, 162, 39, 0.32);
		border-bottom: 1px solid rgba(201, 162, 39, 0.32);
		background-position:
			center,
			right center;
		background-size:
			cover,
			cover;
		box-shadow: 0 24px 56px rgba(0, 0, 0, 0.48);
	}

	.hero-copy {
		max-width: 600px;
		grid-column: 1;
	}

	.eyebrow,
	label,
	.mode-label,
	.theme-chip,
	button,
	.button-link {
		font-family: var(--font-label);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		color: var(--gold);
	}

	h1,
	h2 {
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 800;
		line-height: 0.98;
		color: var(--cream);
	}

	h1 {
		margin: 0 0 0.8rem;
		font-size: clamp(3rem, 8vw, 6.5rem);
	}

	h2 {
		margin: 0 0 0.7rem;
		font-size: clamp(1.4rem, 3vw, 2rem);
	}

	p {
		line-height: 1.55;
		color: var(--lavender);
	}

	.mode-strip {
		display: grid;
		grid-template-columns: repeat(8, minmax(124px, 1fr));
		gap: 0.65rem;
		margin: 1rem 0;
	}

	.mode-card {
		min-height: 158px;
		padding: 0.8rem;
		border: 1px solid rgba(201, 162, 39, 0.22);
		border-radius: 8px;
		color: var(--cream);
		background:
			linear-gradient(180deg, rgba(7, 7, 15, 0.42), rgba(7, 7, 15, 0.92)),
			var(--mode-image);
		background-size: cover;
		background-position: center;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		gap: 0.4rem;
		text-align: left;
	}

	.mode-card.active,
	.mode-card:focus-visible {
		outline: 2px solid var(--mode-color);
		outline-offset: 2px;
	}

	.mode-icon {
		width: 28px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--mode-color);
		color: #07070f;
		font-weight: 900;
	}

	.mode-help {
		font-size: 0.74rem;
		line-height: 1.3;
		color: rgba(253, 246, 227, 0.74);
		text-transform: none;
		letter-spacing: 0;
	}

	.workbench {
		display: grid;
		grid-template-columns: minmax(280px, 0.82fr) minmax(360px, 1.2fr) minmax(260px, 0.78fr);
		gap: 1rem;
		align-items: start;
	}

	.input-panel,
	.preview-panel,
	.settings-panel,
	.verdict-card,
	.vault-card,
	.diagnostics {
		border: 1px solid rgba(201, 162, 39, 0.24);
		border-radius: 8px;
		background: rgba(22, 20, 42, 0.92);
		padding: 1rem;
	}

	.settings-panel summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
		color: var(--gold-bright);
	}

	.settings-panel summary::-webkit-details-marker {
		display: none;
	}

	.settings-panel summary strong {
		display: block;
		margin-top: 0.15rem;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-style: italic;
		color: var(--cream);
		text-transform: none;
		letter-spacing: 0;
	}

	.settings-panel[open] summary {
		margin-bottom: 1rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.16);
	}

	.panel-head {
		margin-bottom: 1rem;
	}

	textarea,
	input,
	select {
		width: 100%;
		margin: 0.35rem 0 0.9rem;
		padding: 0.72rem 0.78rem;
		border-radius: 6px;
		border: 1px solid rgba(201, 162, 39, 0.24);
		background: rgba(7, 7, 15, 0.78);
		color: var(--cream);
		font: inherit;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: 2px solid rgba(240, 196, 74, 0.48);
		outline-offset: 1px;
	}

	.budget {
		margin: 0.2rem 0 0.9rem;
		padding: 0.7rem;
		border-radius: 6px;
		background: rgba(201, 162, 39, 0.09);
		color: var(--gold-bright);
		font-weight: 700;
	}

	.budget p {
		margin: 0.3rem 0 0;
		font-size: 0.84rem;
	}

	.ai-actions,
	.preview-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	button,
	.button-link {
		min-height: 40px;
		padding: 0.58rem 0.82rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.58);
		color: var(--gold-bright);
		text-decoration: none;
		cursor: pointer;
		font-size: 0.78rem;
	}

	button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.primary {
		border: none;
		background: linear-gradient(112deg, #e8006a, #8b16c2 52%, #c9a227);
		color: #fff;
	}

	.preview-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}

	.preview-head img {
		width: 88px;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid rgba(201, 162, 39, 0.28);
	}

	.paper {
		margin: 1rem 0;
		aspect-ratio: 8.5 / 11;
		min-height: 420px;
		border-radius: 8px;
		background: #faf7ee;
		color: #111;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		overflow: hidden;
		position: relative;
	}

	.paper.glitter::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 20% 18%, rgba(201, 162, 39, 0.28), transparent 18%),
			radial-gradient(circle at 82% 34%, rgba(232, 0, 106, 0.18), transparent 16%),
			radial-gradient(circle at 42% 78%, rgba(139, 22, 194, 0.16), transparent 18%);
		pointer-events: none;
	}

	.generated-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.paper-empty {
		width: 82%;
		text-align: center;
		border: 3px solid #111;
		padding: 1rem;
	}

	.paper-title {
		margin: 0 0 1rem;
		font-family: var(--font-label);
		font-size: clamp(1.5rem, 4vw, 2.4rem);
		font-weight: 800;
		color: #111;
		text-transform: uppercase;
	}

	.paper-empty ol {
		margin: 0 auto 1rem;
		text-align: left;
		max-width: 320px;
		font-weight: 800;
	}

	.paper-quote {
		margin: 0;
		color: #111;
		font-weight: 700;
	}

	.theme-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.45rem;
		margin-bottom: 1rem;
	}

	.settings-content {
		display: block;
	}

	.theme-chip {
		justify-content: flex-start;
		text-align: left;
	}

	.theme-chip.active {
		background: rgba(201, 162, 39, 0.18);
		color: var(--cream);
	}

	.toggle {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		color: var(--lavender);
	}

	.toggle input {
		width: auto;
		margin: 0;
	}

	.verdict-row {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
		gap: 1rem;
		margin: 1rem 0;
	}

	.rating {
		display: inline-flex;
		padding: 0.28rem 0.5rem;
		border-radius: 6px;
		background: rgba(232, 0, 106, 0.18);
		color: #ff8ab3;
		font-weight: 800;
	}

	.vault-list {
		display: grid;
		gap: 0.5rem;
	}

	.vault-item {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
		border-top: 1px solid rgba(201, 162, 39, 0.14);
		padding-top: 0.5rem;
	}

	.error {
		margin: 0.7rem 0 0;
		color: #ff8ab3;
	}

	.status {
		color: var(--emerald);
		font-weight: 700;
	}

	.diagnostics {
		margin-top: 1rem;
	}

	.diagnostics summary {
		cursor: pointer;
		color: var(--gold-bright);
		font-weight: 800;
	}

	.diagnostics-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-top: 1rem;
	}

	@media (max-width: 1100px) {
		.mode-strip {
			grid-template-columns: repeat(4, 1fr);
		}

		.workbench {
			grid-template-columns: 1fr;
		}

		.settings-panel[open] .settings-content {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.7rem 1rem;
		}

		.theme-grid,
		.toggle {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 700px) {
		.studio {
			padding: 0.9rem;
		}

		.hero {
			min-height: 400px;
			grid-template-columns: minmax(0, 0.68fr) minmax(0, 0.32fr);
			padding-block: 1.2rem;
			background-position:
				center,
				68% center;
		}

		.mode-strip {
			grid-template-columns: repeat(2, 1fr);
		}

		.verdict-row,
		.diagnostics-grid,
		.settings-panel[open] .settings-content {
			grid-template-columns: 1fr;
		}

		.paper {
			min-height: 360px;
		}
	}
</style>
