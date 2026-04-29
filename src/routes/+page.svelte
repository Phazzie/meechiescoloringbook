<!--
Purpose: Main UI for the coloring book page generator.
Why: Provide manual and chat-assisted builders with evidence panels.
Info flow: User inputs -> seams -> rendered previews + downloads.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { authContextAdapter } from '$lib/adapters/auth-context.adapter';
	import { chatInterpretationAdapter } from '$lib/adapters/chat-interpretation.adapter';
	import { creationStoreAdapter } from '$lib/adapters/creation-store.adapter';
	import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
	import { sessionAdapter } from '$lib/adapters/session.adapter';
	import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
	import {
		clearStoredApiKey,
		loadStoredApiKey,
		postJson,
		saveStoredApiKey
	} from '$lib/core/http-client';
	import { GenerateResultSchema } from '../../contracts/generate.contract';
	import type { CreationOwner, CreationRecord } from '../../contracts/creation-store.contract';
	import type {
		ColoringPageSpec,
		SpecValidationOutput
	} from '../../contracts/spec-validation.contract';
	import type { DriftDetectionOutput, Violation } from '../../contracts/drift-detection.contract';
	import type { GeneratedImage } from '../../contracts/image-generation.contract';
	import type { PackagedFile } from '../../contracts/output-packaging.contract';

	const DEFAULT_SPEC: ColoringPageSpec = {
		title: 'Dream Big',
		items: [
			{ number: 1, label: 'Shine' },
			{ number: 2, label: 'Grow' }
		],
		footerItem: { number: 97, label: 'YOU' },
		listMode: 'list',
		alignment: 'left',
		numberAlignment: 'strict',
		listGutter: 'normal',
		whitespaceScale: 50,
		textSize: 'small',
		fontStyle: 'rounded',
		textStrokeWidth: 6,
		colorMode: 'black_and_white_only',
		decorations: 'minimal',
		illustrations: 'none',
		shading: 'none',
		border: 'decorative',
		borderThickness: 8,
		variations: 1,
		outputFormat: 'pdf',
		pageSize: 'US_Letter'
	};

	let spec: ColoringPageSpec = structuredClone(DEFAULT_SPEC);
	let includeFooter = true;
	let styleHint = 'diamond glam street luxe';
	let dedicationInput = '';
	let chatMessage = '';
	let includeSquareExport = false;
	let includeChatExport = false;
	let showSparkleOverlay = false;
	let validationIssues: SpecValidationOutput['issues'] = [];
	let assembledPrompt = '';
	let revisedPrompt = '';
	let violations: Violation[] = [];
	let recommendedFixes: DriftDetectionOutput['recommendedFixes'] = [];
	let images: GeneratedImage[] = [];
	let imagePreviews: string[] = [];
	let packagedFiles: PackagedFile[] = [];
	let generationError = '';
	let isGenerating = false;
	let isChatInterpreting = false;
	let creations: CreationRecord[] = [];
	let owner: CreationOwner | null = null;
	let authContext: CreationRecord['authContext'] | null = null;
	let sessionStatus = 'Connecting session...';
	let draftStatus = '';
	let apiKeyInput = '';
	let apiKeyStatus = 'No API key saved.';
	let revealApiKey = false;
	let isBrowser = false;
	let draftTimer: ReturnType<typeof setTimeout> | null = null;
	let hasValidated = false;
	let isSpecValid = false;
	let selectedPreset: QuickPresetId | null = null;

	type QuickPresetId = 'minimal' | 'sparkle' | 'story_scene' | 'bold_block';

	const applyQuickPreset = (preset: QuickPresetId): void => {
		selectedPreset = preset;
		switch (preset) {
			case 'minimal':
				styleHint = 'clean luxe outlines with soft spacing';
				spec = {
					...spec,
					decorations: 'minimal',
					illustrations: 'none',
					shading: 'none',
					fontStyle: 'rounded'
				};
				break;
			case 'sparkle':
				styleHint = 'diamond gloss, glitter accents, high glam mood';
				spec = {
					...spec,
					decorations: 'dense',
					illustrations: 'simple',
					shading: 'stippling',
					fontStyle: 'rounded'
				};
				break;
			case 'story_scene':
				styleHint = 'street boutique backdrop with luxe skyline details';
				spec = {
					...spec,
					decorations: 'minimal',
					illustrations: 'scene',
					shading: 'hatch',
					fontStyle: 'hand'
				};
				break;
			case 'bold_block':
				styleHint = 'bold statement lettering and heavy icon shapes';
				spec = {
					...spec,
					decorations: 'none',
					illustrations: 'simple',
					shading: 'none',
					fontStyle: 'block'
				};
				break;
		}
		scheduleDraftSave();
	};

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
		const encoder = new TextEncoder();
		const bytes = encoder.encode(value);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
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
			void validateSpec();
		}, 300);
	};

	const saveDraft = async (): Promise<void> => {
		if (!isBrowser) {
			return;
		}
		draftStatus = 'Saving draft...';
		const result = await creationStoreAdapter.saveDraft({
			draft: {
				updatedAtISO: new Date().toISOString(),
				intent: spec,
				chatMessage: chatMessage.trim().length > 0 ? chatMessage : undefined
			}
		});
		draftStatus = result.ok ? 'Draft saved.' : 'Draft save failed.';
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

	const handleDeleteCreation = async (id: string): Promise<void> => {
		const result = await creationStoreAdapter.deleteCreation({ id });
		if (result.ok) {
			await refreshCreations();
		}
	};

	const toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		const updated = { ...creation, favorite: !creation.favorite };
		const result = await creationStoreAdapter.saveCreation({ record: updated });
		if (result.ok) {
			await refreshCreations();
		}
	};

	const resetOutputs = (): void => {
		generationError = '';
		assembledPrompt = '';
		revisedPrompt = '';
		violations = [];
		recommendedFixes = [];
		images = [];
		packagedFiles = [];
	};

	const saveApiKey = (): void => {
		if (!isBrowser) {
			return;
		}
		const trimmed = apiKeyInput.trim();
		if (trimmed.length === 0) {
			clearStoredApiKey();
			apiKeyStatus = 'API key cleared.';
			return;
		}
		saveStoredApiKey(trimmed);
		apiKeyStatus = 'API key saved in this browser.';
	};

	const clearApiKey = (): void => {
		apiKeyInput = '';
		if (!isBrowser) {
			return;
		}
		clearStoredApiKey();
		apiKeyStatus = 'API key cleared.';
	};

	const validateSpec = async (): Promise<boolean> => {
		const validation = await specValidationAdapter.validate({ spec });
		validationIssues = validation.issues;
		hasValidated = true;
		return validation.ok;
	};

	$: isSpecValid = hasValidated && validationIssues.length === 0;
	$: hasApiKey = apiKeyInput.trim().length > 0;

	const saveDebugTrace = (): void => {
		if (!isBrowser) {
			return;
		}
		try {
			localStorage.setItem(
				'meechie-debug-trace',
				JSON.stringify({ assembledPrompt, revisedPrompt, violations, recommendedFixes })
			);
		} catch {
			// best-effort
		}
	};

	const handleSocialExport = async (): Promise<void> => {
		if (images.length === 0) {
			return;
		}
		isGenerating = true;
		generationError = '';
		try {
			const creationId = generateCreationId();
			const variants: Array<'print' | 'square' | 'chat'> = ['print'];
			if (includeSquareExport) {
				variants.push('square');
			}
			if (includeChatExport) {
				variants.push('chat');
			}
			const packagingResult = await outputPackagingAdapter.package({
				images,
				outputFormat: spec.outputFormat,
				fileBaseName: `coloring-page-${creationId}`,
				pageSize: spec.pageSize,
				variants
			});
			if (packagingResult.ok) {
				packagedFiles = packagingResult.value.files;
			} else {
				generationError = packagingResult.error.message;
			}
		} finally {
			isGenerating = false;
		}
	};

	const handleGenerate = async (): Promise<void> => {
		resetOutputs();
		isGenerating = true;
		try {
			const isValid = await validateSpec();
			if (!isValid) {
				generationError = 'Fix the issues above before generating.';
				return;
			}

			const { payload } = await postJson(
				'/api/generate',
				{
					spec,
					styleHint: styleHint.trim().length > 0 ? styleHint : undefined
				},
				apiKeyInput
			);
			const parsedGenerate = GenerateResultSchema.safeParse(payload);
			if (!parsedGenerate.success) {
				generationError = 'Generate response did not match contract.';
				return;
			}
			if (!parsedGenerate.data.ok) {
				generationError = parsedGenerate.data.error.message;
				return;
			}

			assembledPrompt = parsedGenerate.data.value.prompt;
			images = parsedGenerate.data.value.images;
			revisedPrompt = parsedGenerate.data.value.revisedPrompt || '';
			violations = parsedGenerate.data.value.violations;
			recommendedFixes = parsedGenerate.data.value.recommendedFixes;
			saveDebugTrace();

			const creationId = generateCreationId();
			const variants: Array<'print' | 'square' | 'chat'> = ['print'];
			const packagingResult = await outputPackagingAdapter.package({
				images,
				outputFormat: spec.outputFormat,
				fileBaseName: `coloring-page-${creationId}`,
				pageSize: spec.pageSize,
				variants
			});
			if (packagingResult.ok) {
				packagedFiles = packagingResult.value.files;
			} else {
				generationError = packagingResult.error.message;
			}

			if (owner && authContext) {
				const storedImages = images.map((image) => ({
					b64: image.encoding === 'base64' ? image.data : encodeBase64(image.data)
				}));
				await creationStoreAdapter.saveCreation({
					record: {
						id: creationId,
						createdAtISO: new Date().toISOString(),
						intent: spec,
						assembledPrompt: parsedGenerate.data.value.prompt,
						revisedPrompt: parsedGenerate.data.value.revisedPrompt,
						images: storedImages,
						violations: parsedGenerate.data.value.violations,
						fixesApplied: parsedGenerate.data.value.recommendedFixes.map((fix) => fix.code),
						authContext,
						owner
					}
				});
				await refreshCreations();
			}
		} catch (generateError) {
			generationError = generateError instanceof Error ? generateError.message : 'Something blocked the drop — try again or change the vibe.';
		} finally {
			isGenerating = false;
		}
	};

	const handleChatInterpretation = async (): Promise<void> => {
		isChatInterpreting = true;
		generationError = '';
		try {
			const result = await chatInterpretationAdapter.interpret({ message: chatMessage });
			if (result.ok) {
				spec = result.value.spec;
				includeFooter = spec.listMode !== 'title_only' && !!spec.footerItem;
				dedicationInput = spec.dedication ?? '';
				await validateSpec();
				scheduleDraftSave();
			} else {
				generationError = result.error.message;
			}
		} finally {
			isChatInterpreting = false;
		}
	};

	const addItem = (): void => {
		if (spec.listMode === 'title_only') {
			spec = {
				...spec,
				listMode: 'list',
				items: [{ number: 1, label: '' }]
			};
		}
		if (spec.items.length >= 20) {
			return;
		}
		const nextNumber = spec.items.length + 1;
		spec = {
			...spec,
			items: [...spec.items, { number: nextNumber, label: '' }]
		};
		scheduleDraftSave();
	};

	const removeItem = (index: number): void => {
		if (spec.listMode === 'title_only') {
			return;
		}
		if (spec.items.length <= 1) {
			return;
		}
		spec = {
			...spec,
			items: spec.items.filter((_, itemIndex) => itemIndex !== index)
		};
		scheduleDraftSave();
	};

	const toggleFooter = (): void => {
		if (spec.listMode === 'title_only') {
			return;
		}
		includeFooter = !includeFooter;
		spec = {
			...spec,
			footerItem: includeFooter ? { number: 97, label: 'YOU' } : undefined
		};
		scheduleDraftSave();
	};

	const setListMode = (mode: ColoringPageSpec['listMode']): void => {
		if (mode === 'title_only') {
			includeFooter = false;
			spec = {
				...spec,
				listMode: 'title_only',
				items: [],
				footerItem: undefined
			};
		} else {
			spec = {
				...spec,
				listMode: 'list',
				items: spec.items.length > 0 ? spec.items : [{ number: 1, label: '' }]
			};
		}
		scheduleDraftSave();
	};

	const handleListModeChange = (event: Event): void => {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		setListMode(target.value as ColoringPageSpec['listMode']);
	};

	const resetSpec = (): void => {
		spec = structuredClone(DEFAULT_SPEC);
		includeFooter = !!DEFAULT_SPEC.footerItem;
		styleHint = 'diamond glam street luxe';
		dedicationInput = '';
		selectedPreset = null;
		validationIssues = [];
		resetOutputs();
		scheduleDraftSave();
	};

	const setDedication = (value: string): void => {
		dedicationInput = value;
		const trimmed = value.trim();
		spec = {
			...spec,
			dedication: trimmed.length > 0 ? value : undefined
		};
		scheduleDraftSave();
	};

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
		const storedApiKey = loadStoredApiKey();
		if (storedApiKey && storedApiKey.trim().length > 0) {
			apiKeyInput = storedApiKey;
			apiKeyStatus = 'API key loaded from this browser.';
		}
		const sessionResult = await sessionAdapter.getSession();
		if (sessionResult.ok) {
			owner = buildOwner(sessionResult.value.sessionId);
			sessionStatus = 'Session connected';
			const authResult = await authContextAdapter.getAuthContext({
				sessionId: sessionResult.value.sessionId
			});
			if (authResult.ok) {
				authContext = authResult.value;
			}
		} else {
			sessionStatus = 'Session unavailable';
		}

		const draftResult = await creationStoreAdapter.getDraft({});
		if (draftResult.ok && draftResult.value) {
			spec = draftResult.value.intent;
			includeFooter = spec.listMode !== 'title_only' && !!spec.footerItem;
			chatMessage = draftResult.value.chatMessage || '';
			dedicationInput = spec.dedication ?? '';
		}

		await validateSpec();
		await refreshCreations();
	});
</script>

<svelte:head>
	<title>Meechie Street Glam Coloring Studio</title>
</svelte:head>

<div class="page">
	<div class="ambient ambient-a" aria-hidden="true"></div>
	<div class="ambient ambient-b" aria-hidden="true"></div>
	<header class="hero">
		<div class="hero-copy">
			<p class="eyebrow">Meechie Studio</p>
			<h1>The page they remember. The energy they cannot copy.</h1>
			<p class="subhead">
				State the vibe, lock the style, and print it clean. Fast when you want speed, precise when you
				want control.
			</p>
			<div class="flow-steps" aria-label="Workflow progress">
				<div class="step" class:done={isSpecValid}>
					<span>1</span>
					<p>Call it</p>
				</div>
				<div class="step" class:done={imagePreviews.length > 0}>
					<span>2</span>
					<p>Preview</p>
				</div>
				<div class="step" class:done={packagedFiles.length > 0}>
					<span>3</span>
					<p>Print</p>
				</div>
			</div>
		</div>
	</header>

	<!-- API key gate: full card on first visit, compressed status bar once saved -->
	{#if hasApiKey}
		<div class="api-status-bar">
			<span class="api-ok">✓ Key saved</span>
			<button type="button" class="ghost tiny" on:click={clearApiKey}>Change</button>
		</div>
	{:else}
		<section class="card api-gate">
			<h2>One-time setup</h2>
			<p class="api-gate-copy">Paste your key below to get started. Stays in this browser only.</p>
			<div class="api-key-row">
				<div class="api-key-field-wrap">
					<input
						type={revealApiKey ? 'text' : 'password'}
						bind:value={apiKeyInput}
						placeholder="Paste key here"
						autocomplete="off"
						spellcheck="false"
						class="api-key-input"
					/>
					<button
						type="button"
						class="eye-toggle"
						aria-label={revealApiKey ? 'Hide key' : 'Show key'}
						on:click={() => (revealApiKey = !revealApiKey)}
					>
						{revealApiKey ? '🙈' : '👁'}
					</button>
				</div>
				<button type="button" class="primary" on:click={saveApiKey}>Lock it in</button>
			</div>
		</section>
	{/if}

	<!-- Everything below is dimmed until a key is saved -->
	<div class="content-gate" class:locked={!hasApiKey}>
		{#if !hasApiKey}
			<p class="locked-notice" aria-live="polite">Add your key above to unlock.</p>
		{/if}

		<!-- Meechie Tools spotlight — before the builder -->
		<section class="card meechie-spotlight">
			<div class="spotlight-header">
				<p class="eyebrow">Meechie Tools</p>
				<h2>Sharp tools for sharp situations.</h2>
			</div>
			<div class="spotlight-pills">
				<span class="tool-pill">Return Fire</span>
				<span class="tool-pill">Apology Autopsy</span>
				<span class="tool-pill">Receipt Check</span>
			</div>
			<p class="spotlight-copy">Clapbacks, cold reads, and decisions. All in one place.</p>
			<a class="primary meechie-spotlight-btn" href="/meechie">Open Meechie Tools</a>
		</section>

		<!-- Chat card -->
		<section class="card chat">
			<h2>Tell Meechie</h2>
			<p class="section-sub">Say the vibe. She handles the rest.</p>
			<div class="field">
				<label for="chat">What do you want on your page?</label>
				<textarea
					id="chat"
					rows="3"
					bind:value={chatMessage}
					on:input={scheduleDraftSave}
					placeholder="Example: glam birthday theme with diamonds, heels, and bold lettering"
				></textarea>
			</div>
			<button
				type="button"
				class="primary"
				on:click={handleChatInterpretation}
				disabled={isChatInterpreting}
			>
				{isChatInterpreting ? 'Reading the room…' : 'Make My Page'}
			</button>
		</section>

		<!-- Builder section — full width, no grid -->
		<section class="card builder">
			<h2>Build It Yourself</h2>
			<p class="section-sub">Dial in exactly what you want.</p>

			<div class="field">
				<label for="title">Main headline</label>
				<input
					id="title"
					type="text"
					bind:value={spec.title}
					on:input={scheduleDraftSave}
					class:field-error={validationIssues.some((i) => i.field === 'title')}
				/>
				{#each validationIssues.filter((i) => i.field === 'title') as issue}
					<p class="field-error-msg">{issue.message}</p>
				{/each}
			</div>

			<div class="field">
				<p class="label">Page layout</p>
				<div class="chip-group">
					<button
						type="button"
						class="chip"
						class:active={spec.listMode === 'list'}
						on:click={() => setListMode('list')}
					>Headline + list</button>
					<button
						type="button"
						class="chip"
						class:active={spec.listMode === 'title_only'}
						on:click={() => setListMode('title_only')}
					>Headline only</button>
				</div>
			</div>

			{#if spec.listMode === 'list'}
				<fieldset class="field">
					<legend>List lines</legend>
					<div class="items">
						{#each spec.items as item, index}
							<div class="item-row">
								<input
									type="number"
									min="1"
									max="999"
									bind:value={item.number}
									on:input={scheduleDraftSave}
								/>
								<input
									type="text"
									maxlength="40"
									bind:value={item.label}
									on:input={scheduleDraftSave}
									placeholder="Label"
									class:field-error={validationIssues.some((i) => i.field === 'items')}
								/>
								<button
									type="button"
									class="ghost icon-btn"
									disabled={spec.items.length <= 1}
									on:click={() => removeItem(index)}
								>✕</button>
							</div>
						{/each}
						{#each validationIssues.filter((i) => i.field === 'items') as issue}
							<p class="field-error-msg">{issue.message.replace(/^items:\s*/i, '')}</p>
						{/each}
						<button
							type="button"
							class="ghost"
							disabled={spec.items.length >= 20}
							on:click={addItem}
						>+ Add line</button>
					</div>
				</fieldset>

				<div class="field">
					<label class="toggle">
						<input type="checkbox" bind:checked={includeFooter} on:change={toggleFooter} />
						<span>Include footer item</span>
					</label>
					{#if includeFooter && spec.footerItem}
						<div class="item-row">
							<input
								type="number"
								min="1"
								max="999"
								bind:value={spec.footerItem.number}
								on:input={scheduleDraftSave}
							/>
							<input
								type="text"
								maxlength="40"
								bind:value={spec.footerItem.label}
								on:input={scheduleDraftSave}
							/>
						</div>
					{/if}
				</div>
			{:else}
				<p class="hint">Headline-only mode — list lines and footer are hidden.</p>
			{/if}

			<div class="field">
				<label for="dedication">Shoutout (optional)</label>
				<input
					id="dedication"
					type="text"
					maxlength="60"
					value={dedicationInput}
					on:input={(event) => setDedication((event.target as HTMLInputElement).value)}
					placeholder="Dedicated to..."
				/>
			</div>

			<div class="field">
				<label for="styleHint">Vibe words</label>
				<input
					id="styleHint"
					type="text"
					bind:value={styleHint}
					on:input={scheduleDraftSave}
					placeholder="glitzy, gritty, luxury, street"
				/>
			</div>

			<div class="field">
				<p class="label">Vibe presets</p>
				<div class="preset-row">
					<button
						type="button"
						class="ghost preset"
						class:active={selectedPreset === 'minimal'}
						on:click={() => applyQuickPreset('minimal')}
					>Soft Luxe</button>
					<button
						type="button"
						class="ghost preset"
						class:active={selectedPreset === 'sparkle'}
						on:click={() => applyQuickPreset('sparkle')}
					>Diamond Night</button>
					<button
						type="button"
						class="ghost preset"
						class:active={selectedPreset === 'story_scene'}
						on:click={() => applyQuickPreset('story_scene')}
					>City Story</button>
					<button
						type="button"
						class="ghost preset"
						class:active={selectedPreset === 'bold_block'}
						on:click={() => applyQuickPreset('bold_block')}
					>Boss Energy</button>
				</div>
			</div>

			<div class="field-row">
				<div class="field">
					<p class="label">How many versions</p>
					<div class="chip-group">
						{#each [1, 2, 3, 4] as n}
							<button
								type="button"
								class="chip"
								class:active={spec.variations === n}
								on:click={() => {
									spec = { ...spec, variations: n };
									scheduleDraftSave();
								}}
							>{n}</button>
						{/each}
					</div>
				</div>
				<div class="field">
					<p class="label">Download type</p>
					<div class="chip-group">
						<button
							type="button"
							class="chip"
							class:active={spec.outputFormat === 'pdf'}
							on:click={() => {
								spec = { ...spec, outputFormat: 'pdf' };
								scheduleDraftSave();
							}}
						>PDF</button>
						<button
							type="button"
							class="chip"
							class:active={spec.outputFormat === 'png'}
							on:click={() => {
								spec = { ...spec, outputFormat: 'png' };
								scheduleDraftSave();
							}}
						>PNG</button>
					</div>
				</div>
			</div>

			<div class="actions">
				<button
					type="button"
					class="primary"
					on:click={handleGenerate}
					disabled={!isSpecValid || isGenerating}
				>
					{isGenerating ? 'Creating…' : 'Create Pages'}
				</button>
				<button type="button" class="ghost" on:click={resetSpec}>Reset</button>
			</div>

			{#if selectedPreset}
				<details class="advanced-toggle">
					<summary>Fine-tune this look</summary>
					<div class="advanced-content">
						<div class="field-row">
							<div class="field">
								<p class="label">Font style</p>
								<div class="chip-group">
									<button
										type="button"
										class="chip"
										class:active={spec.fontStyle === 'rounded'}
										on:click={() => {
											spec = { ...spec, fontStyle: 'rounded' };
											scheduleDraftSave();
										}}
									>Soft</button>
									<button
										type="button"
										class="chip"
										class:active={spec.fontStyle === 'block'}
										on:click={() => {
											spec = { ...spec, fontStyle: 'block' };
											scheduleDraftSave();
										}}
									>Sharp</button>
									<button
										type="button"
										class="chip"
										class:active={spec.fontStyle === 'hand'}
										on:click={() => {
											spec = { ...spec, fontStyle: 'hand' };
											scheduleDraftSave();
										}}
									>Handmade</button>
								</div>
							</div>
							<div class="field">
								<p class="label">Color mode</p>
								<div class="chip-group">
									<button
										type="button"
										class="chip"
										class:active={spec.colorMode === 'black_and_white_only'}
										on:click={() => {
											spec = { ...spec, colorMode: 'black_and_white_only' };
											scheduleDraftSave();
										}}
									>B+W</button>
									<button
										type="button"
										class="chip"
										class:active={spec.colorMode === 'grayscale'}
										on:click={() => {
											spec = { ...spec, colorMode: 'grayscale' };
											scheduleDraftSave();
										}}
									>Gray</button>
									<button
										type="button"
										class="chip"
										class:active={spec.colorMode === 'color'}
										on:click={() => {
											spec = { ...spec, colorMode: 'color' };
											scheduleDraftSave();
										}}
									>Color</button>
								</div>
							</div>
						</div>
						<div class="field-row">
							<div class="field">
								<label for="decorations">Interior decorations</label>
								<select id="decorations" bind:value={spec.decorations} on:change={scheduleDraftSave}>
									<option value="none">None</option>
									<option value="minimal">Some</option>
									<option value="dense">A lot</option>
								</select>
							</div>
							<div class="field">
								<label for="illustrations">Illustrations</label>
								<select id="illustrations" bind:value={spec.illustrations} on:change={scheduleDraftSave}>
									<option value="none">None</option>
									<option value="simple">Simple</option>
									<option value="scene">Full scene</option>
								</select>
							</div>
						</div>
					</div>
				</details>
			{/if}

			{#if validationIssues.some((i) => i.field !== 'title' && i.field !== 'items')}
				<div class="issues">
					{#each validationIssues.filter((i) => i.field !== 'title' && i.field !== 'items') as issue}
						<p class="field-error-msg">{issue.message}</p>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Reveal panel: shimmer while generating, results once done, error if failed -->
		{#if isGenerating || imagePreviews.length > 0 || generationError}
			<section class="card reveal-panel" class:reveal-enter={imagePreviews.length > 0}>
				{#if isGenerating && imagePreviews.length === 0}
					<div class="shimmer-wrap" aria-label="Generating your look…">
						<div class="shimmer-img"></div>
						<div class="shimmer-line"></div>
						<div class="shimmer-line shimmer-line-short"></div>
					</div>
				{:else if generationError && imagePreviews.length === 0}
					<p class="error">{generationError}</p>
					{#if recommendedFixes.length > 0}
						<button type="button" class="ghost" on:click={handleGenerate}>
							Try again with fixes
						</button>
					{/if}
				{:else}
					<h2>Here's your look.</h2>
					{#if generationError}
						<p class="error">{generationError}</p>
					{/if}
					<div class="preview-grid">
						{#each imagePreviews as preview, index}
							<figure>
								<div class="img-wrap">
									<img src={preview} alt={`Generated page ${index + 1}`} />
									<button
										type="button"
										class="sparkle-btn"
										class:active={showSparkleOverlay}
										on:click={() => (showSparkleOverlay = !showSparkleOverlay)}
										aria-label="Toggle glitter glow"
										title="Toggle glitter glow"
									>✦</button>
									{#if showSparkleOverlay}
										<div class="sparkle-overlay" aria-hidden="true"></div>
									{/if}
								</div>
								{#if imagePreviews.length > 1}
									<figcaption>Version {index + 1}</figcaption>
								{/if}
							</figure>
						{/each}
					</div>

					{#if packagedFiles.length > 0}
						<div class="downloads">
							<p class="downloads-label">Your look is ready.</p>
							{#each packagedFiles as file, index}
								<a
									class="primary download-btn"
									href={`data:${file.mimeType};base64,${file.dataBase64}`}
									download={file.filename}
								>
									{packagedFiles.length === 1
										? 'Download your page'
										: `Download version ${index + 1}`}
								</a>
							{/each}
							<div class="social-chips">
								<button
									type="button"
									class="chip"
									class:active={includeSquareExport}
									on:click={() => (includeSquareExport = !includeSquareExport)}
								>Square for IG</button>
								<button
									type="button"
									class="chip"
									class:active={includeChatExport}
									on:click={() => (includeChatExport = !includeChatExport)}
								>Share size</button>
							</div>
							{#if includeSquareExport || includeChatExport}
								<button type="button" class="ghost" on:click={handleSocialExport}>
									Get these too
								</button>
							{/if}
						</div>
					{/if}
				{/if}
			</section>
		{/if}

		<!-- Saved Looks -->
		<section class="card history">
			<h2>Saved Looks</h2>
			{#if creations.length === 0}
				<p class="empty">Nothing saved yet — your first look will live here.</p>
			{:else}
				<div class="creations">
					{#each creations as creation}
						<div class="creation">
							<div>
								<p class="title">
									{creation.intent.title}
									{#if creation.favorite}
										<span class="favorite-pill">★ featured</span>
									{/if}
								</p>
								<p class="meta">{creation.createdAtISO}</p>
							</div>
							<div class="creation-actions">
								<button
									type="button"
									class="ghost"
									on:click={() => {
										spec = creation.intent;
										includeFooter = !!spec.footerItem;
										dedicationInput = spec.dedication ?? '';
										scheduleDraftSave();
									}}
								>Use this</button>
								<button
									type="button"
									class="ghost icon-btn"
									title={creation.favorite ? 'Unpin' : 'Pin'}
									on:click={() => toggleFavorite(creation)}
								>{creation.favorite ? '★' : '☆'}</button>
								<button
									type="button"
									class="ghost icon-btn danger"
									title="Delete"
									on:click={() => handleDeleteCreation(creation.id)}
								>✕</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<div class="mobile-actions" aria-label="Quick actions">
		<button
			type="button"
			class="primary mobile-primary"
			on:click={handleGenerate}
			disabled={!isSpecValid || isGenerating || !hasApiKey}
		>
			{isGenerating ? 'Creating…' : 'Create Pages'}
		</button>
	</div>
</div>

<style>
	:global(body) {
		--fuchsia: #e8006a;
		--fuchsia-glow: rgba(232, 0, 106, 0.22);
		--gold: #c9a227;
		--gold-bright: #f0c44a;
		--gold-border: rgba(201, 162, 39, 0.35);
		--cream: #fdf6e3;
		--lavender: #b8aacf;
		--dark-base: #07070f;
		--dark-surface: #100f1c;
		--dark-card: #16142a;
		--dark-card-alt: #1c1932;
		--emerald: #00c896;
		margin: 0;
		font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif;
		color: var(--cream);
		background:
			radial-gradient(circle at 0% 0%, rgba(232, 0, 106, 0.18), transparent 38%),
			radial-gradient(circle at 100% 0%, rgba(107, 33, 168, 0.2), transparent 42%),
			radial-gradient(circle at 50% 100%, rgba(201, 162, 39, 0.08), transparent 50%),
			linear-gradient(180deg, #07070f, #0d0b1a 60%, #070710);
		min-height: 100vh;
	}

	.page {
		position: relative;
		max-width: 1220px;
		margin: 0 auto;
		padding: 2.4rem 1.4rem 4rem;
	}

	.ambient {
		position: absolute;
		pointer-events: none;
		filter: blur(9px);
		z-index: 0;
	}

	.ambient-a {
		top: 4.2rem;
		right: -0.5rem;
		width: clamp(180px, 26vw, 340px);
		aspect-ratio: 1;
		border-radius: 36% 64% 54% 46%;
		background: linear-gradient(145deg, rgba(232, 0, 106, 0.26), rgba(107, 33, 168, 0.18));
		animation: drift 14s ease-in-out infinite;
	}

	.ambient-b {
		top: 20rem;
		left: -4rem;
		width: clamp(170px, 20vw, 300px);
		aspect-ratio: 1;
		border-radius: 46% 54% 44% 56%;
		background: linear-gradient(145deg, rgba(201, 162, 39, 0.2), rgba(107, 33, 168, 0.15));
		animation: drift 17s ease-in-out infinite reverse;
	}

	.hero {
		position: relative;
		z-index: 1;
		padding: 1.6rem 0.2rem 2rem;
		margin-bottom: 1.4rem;
	}

	.eyebrow {
		margin: 0 0 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--gold);
	}

	h1 {
		margin: 0 0 0.7rem;
		max-width: 18ch;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(2.2rem, 5.2vw, 3.8rem);
		font-style: italic;
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.03em;
		color: var(--cream);
	}

	.subhead {
		margin: 0;
		max-width: 520px;
		font-size: 1rem;
		line-height: 1.45;
		color: var(--lavender);
	}

	.flow-steps {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1.2rem;
	}

	.step {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.34rem 0.72rem;
		border-radius: 999px;
		background: rgba(22, 20, 42, 0.7);
		border: 1px solid var(--gold-border);
	}

	.step span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 50%;
		font-size: 0.72rem;
		font-weight: 700;
		background: rgba(201, 162, 39, 0.2);
		color: var(--gold-bright);
	}

	.step p {
		margin: 0;
		font-size: 0.77rem;
		font-weight: 700;
		color: var(--lavender);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.step.done {
		border-color: rgba(0, 200, 150, 0.4);
		background: rgba(0, 200, 150, 0.08);
	}

	.step.done span {
		background: linear-gradient(130deg, #00c896, #00a87a);
		color: #021a12;
	}

	.step.done p {
		color: #00c896;
	}

	.content-gate {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.content-gate.locked {
		pointer-events: none;
		opacity: 0.45;
		filter: blur(0.5px);
	}

	.locked-notice {
		text-align: center;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--gold);
		letter-spacing: 0.06em;
		padding: 0.6rem;
		pointer-events: none;
	}

	/* API gate */
	.api-gate {
		position: relative;
		z-index: 2;
		margin-bottom: 1rem;
		background: linear-gradient(160deg, rgba(201, 162, 39, 0.07), rgba(22, 20, 42, 0.96));
	}

	.api-gate-copy {
		margin: 0 0 1rem;
		font-size: 0.94rem;
		color: var(--lavender);
	}

	.api-key-row {
		display: flex;
		gap: 0.75rem;
		align-items: stretch;
		flex-wrap: wrap;
	}

	.api-key-field-wrap {
		position: relative;
		flex: 1;
		min-width: 180px;
	}

	.api-key-input {
		width: 100%;
		padding-right: 2.8rem;
		box-sizing: border-box;
	}

	.eye-toggle {
		position: absolute;
		right: 0.55rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		padding: 0.25rem;
		color: var(--lavender);
		line-height: 1;
	}

	.api-status-bar {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-radius: 999px;
		background: rgba(0, 200, 150, 0.07);
		border: 1px solid rgba(0, 200, 150, 0.28);
		margin-bottom: 1rem;
		width: fit-content;
	}

	.api-ok {
		font-size: 0.82rem;
		font-weight: 700;
		color: #00c896;
		letter-spacing: 0.04em;
	}

	/* Meechie spotlight */
	.meechie-spotlight {
		background: linear-gradient(160deg, rgba(107, 33, 168, 0.1), rgba(22, 20, 42, 0.96));
	}

	.spotlight-header {
		margin-bottom: 0.75rem;
	}

	.spotlight-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.tool-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.32rem 0.82rem;
		border-radius: 999px;
		border: 1px solid rgba(107, 33, 168, 0.45);
		background: rgba(107, 33, 168, 0.14);
		font-size: 0.79rem;
		font-weight: 700;
		color: #c4b5fd;
		letter-spacing: 0.04em;
	}

	.spotlight-copy {
		margin: 0 0 1rem;
		font-size: 0.94rem;
		color: var(--lavender);
	}

	.meechie-spotlight-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
	}

	/* Chat card */
	.chat {
		background: linear-gradient(160deg, rgba(232, 0, 106, 0.08), rgba(22, 20, 42, 0.95));
	}

	.section-sub {
		margin: -0.4rem 0 0.9rem;
		font-size: 0.94rem;
		color: var(--lavender);
	}

	/* Builder */
	.builder {
		background: var(--dark-card);
	}

	/* Chip selectors */
	.chip-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.chip {
		padding: 0.38rem 0.88rem;
		border-radius: 999px;
		border: 1px solid var(--gold-border);
		background: transparent;
		color: var(--lavender);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
		font-family: inherit;
	}

	.chip:hover {
		border-color: var(--gold);
		color: var(--gold-bright);
	}

	.chip.active {
		border-color: var(--gold);
		background: rgba(201, 162, 39, 0.16);
		color: var(--gold-bright);
	}

	/* Active preset highlight */
	.ghost.preset.active {
		border-color: var(--gold);
		background: rgba(201, 162, 39, 0.14);
		color: var(--gold-bright);
	}

	/* Inline field errors */
	.field-error {
		border-color: rgba(232, 0, 106, 0.65) !important;
		box-shadow: 0 0 0 2px rgba(232, 0, 106, 0.1);
	}

	.field-error-msg {
		margin: 0;
		font-size: 0.78rem;
		color: #ff8ab3;
	}

	/* Reveal panel */
	.reveal-panel {
		background: var(--dark-card-alt);
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: scale(0.97) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.reveal-enter {
		animation: reveal 200ms ease-out forwards;
	}

	/* Shimmer */
	.shimmer-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.5rem 0;
	}

	.shimmer-img {
		height: 260px;
		border-radius: 0.82rem;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 25%,
			rgba(255, 255, 255, 0.09) 50%,
			rgba(255, 255, 255, 0.04) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}

	.shimmer-line {
		height: 0.85rem;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 25%,
			rgba(255, 255, 255, 0.09) 50%,
			rgba(255, 255, 255, 0.04) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}

	.shimmer-line-short {
		width: 60%;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Image wrap with sparkle overlay */
	.img-wrap {
		position: relative;
	}

	.preview-grid img {
		width: 100%;
		border-radius: 0.82rem;
		border: 1px solid var(--gold-border);
		background: #1c1932;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
		display: block;
	}

	.sparkle-btn {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid rgba(240, 196, 74, 0.4);
		background: rgba(7, 7, 15, 0.7);
		color: rgba(240, 196, 74, 0.7);
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.18s ease, color 0.18s ease;
		backdrop-filter: blur(4px);
	}

	.sparkle-btn.active {
		background: rgba(240, 196, 74, 0.2);
		color: var(--gold-bright);
		border-color: var(--gold);
	}

	.sparkle-overlay {
		position: absolute;
		inset: 0;
		border-radius: 0.82rem;
		background:
			radial-gradient(circle at 16% 20%, rgba(240, 196, 74, 0.5), transparent 30%),
			radial-gradient(circle at 82% 28%, rgba(232, 0, 106, 0.4), transparent 34%),
			radial-gradient(circle at 38% 76%, rgba(107, 33, 168, 0.35), transparent 40%),
			radial-gradient(circle at 72% 78%, rgba(240, 196, 74, 0.3), transparent 44%);
		opacity: 0.7;
		mix-blend-mode: screen;
		pointer-events: none;
	}

	/* Downloads */
	.downloads {
		margin-top: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.downloads-label {
		margin: 0 0 0.2rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-style: italic;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--cream);
	}

	.download-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		width: 100%;
		box-sizing: border-box;
	}

	.social-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}

	/* Icon-only buttons */
	.icon-btn {
		padding: 0.38rem 0.6rem;
		font-size: 0.88rem;
	}

	.card {
		position: relative;
		padding: 1.45rem;
		border-radius: 1.2rem;
		background: var(--dark-card);
		border: 1px solid var(--gold-border);
		box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
	}

	.card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 1.2rem;
		padding: 1px;
		background: linear-gradient(
			130deg,
			rgba(232, 0, 106, 0.3),
			rgba(201, 162, 39, 0.25),
			rgba(107, 33, 168, 0.2)
		);
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
		pointer-events: none;
	}

	.builder {
		background: var(--dark-card);
	}

	h2 {
		margin: 0 0 0.9rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: 1.5rem;
		font-style: italic;
		font-weight: 800;
		letter-spacing: -0.01em;
		color: var(--cream);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	fieldset.field {
		border: none;
		padding: 0;
		margin: 0 0 1rem;
	}

	legend,
	label,
	.label {
		margin: 0;
		font-weight: 700;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--gold);
	}

	.field-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.9rem;
		margin-bottom: 1rem;
	}

	.preset-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.preset {
		padding: 0.42rem 0.85rem;
		font-size: 0.79rem;
	}

	input,
	select,
	textarea {
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		padding: 0.62rem 0.72rem;
		font-size: 0.94rem;
		font-family: inherit;
		color: var(--cream);
		background: rgba(7, 7, 15, 0.7);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--gold);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
	}

	input::placeholder,
	textarea::placeholder {
		color: rgba(184, 170, 207, 0.45);
	}

	select option {
		background: #1c1932;
		color: var(--cream);
	}

	textarea {
		resize: vertical;
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.item-row {
		display: grid;
		grid-template-columns: 80px 1fr auto;
		gap: 0.6rem;
		align-items: center;
	}

	.toggle {
		display: flex;
		gap: 0.56rem;
		align-items: center;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--lavender);
		text-transform: none;
		letter-spacing: normal;
	}

	.actions {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		margin-bottom: 1rem;
	}

	.primary {
		border: none;
		border-radius: 999px;
		padding: 0.72rem 1.4rem;
		background: linear-gradient(112deg, #e8006a, #6b21a8 52%, #c9a227);
		color: #fff;
		font-weight: 800;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
		text-transform: uppercase;
	}

	.primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 14px 28px rgba(232, 0, 106, 0.35);
		filter: saturate(1.1) brightness(1.05);
	}

	.ghost {
		border-radius: 999px;
		padding: 0.52rem 0.96rem;
		border: 1px solid var(--gold-border);
		background: transparent;
		color: var(--gold-bright);
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
	}

	.ghost.tiny {
		padding: 0.36rem 0.72rem;
		font-size: 0.76rem;
	}

	.ghost:hover {
		transform: translateY(-1px);
		border-color: var(--gold);
		box-shadow: 0 6px 16px rgba(201, 162, 39, 0.18);
	}

	.ghost:disabled,
	.primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.hint {
		font-size: 0.79rem;
		color: var(--lavender);
	}

	.issues {
		padding: 0.95rem;
		border-radius: 0.95rem;
		background: rgba(232, 0, 106, 0.1);
		border: 1px solid rgba(232, 0, 106, 0.35);
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 1rem;
	}

	.preview-grid figure {
		position: relative;
	}

	figcaption {
		margin-top: 0.4rem;
		text-align: center;
		font-size: 0.82rem;
		color: var(--lavender);
	}

	p.error {
		margin: 0 0 0.7rem;
		color: #ff8ab3;
		background: rgba(232, 0, 106, 0.12);
		border: 1px solid rgba(232, 0, 106, 0.35);
		padding: 0.7rem;
		border-radius: 0.8rem;
	}

	.empty {
		color: var(--lavender);
		font-style: italic;
	}

	.history {
		position: relative;
		z-index: 1;
	}

	.creations {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.9rem;
	}

	.creation {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.9rem;
		border-radius: 0.95rem;
		border: 1px solid var(--gold-border);
		background: rgba(7, 7, 15, 0.6);
	}

	.creation .title {
		margin-bottom: 0.2rem;
		font-weight: 700;
		color: var(--cream);
	}

	.creation .meta {
		font-size: 0.75rem;
		color: var(--lavender);
	}

	.creation-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.favorite-pill {
		display: inline-flex;
		align-items: center;
		margin-left: 0.4rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		font-size: 0.65rem;
		background: rgba(201, 162, 39, 0.2);
		color: var(--gold-bright);
	}

	.ghost.danger {
		color: #ff6b8a;
		border-color: rgba(232, 0, 106, 0.4);
	}

	.advanced-content {
		margin-top: 0.9rem;
	}

	.advanced-toggle {
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(201, 162, 39, 0.15);
	}

	.advanced-toggle summary {
		cursor: pointer;
		list-style: none;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--gold);
		padding: 0.4rem 0;
	}

	.advanced-toggle summary::-webkit-details-marker {
		display: none;
	}

	.advanced-toggle summary::after {
		content: '›';
		margin-left: 0.4rem;
	}

	.advanced-toggle[open] summary::after {
		content: '‹';
	}

	.mobile-actions {
		display: none;
	}

	@media (max-width: 900px) {
		h1 {
			max-width: none;
		}

		.item-row {
			grid-template-columns: 1fr;
		}

		.builder .actions {
			display: none;
		}

		.page {
			padding-bottom: 6rem;
		}

		.mobile-actions {
			position: fixed;
			left: 0.8rem;
			right: 0.8rem;
			bottom: max(0.7rem, env(safe-area-inset-bottom));
			z-index: 20;
			display: flex;
			padding: 0.52rem;
			border-radius: 0.95rem;
			background: rgba(7, 7, 15, 0.92);
			border: 1px solid var(--gold-border);
			backdrop-filter: blur(8px);
			box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
		}

		.mobile-actions .mobile-primary {
			width: 100%;
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: 1.35rem 0.88rem 7rem;
		}

		.actions {
			flex-wrap: wrap;
		}
	}

	@keyframes drift {
		0%,
		100% {
			transform: translate3d(0, 0, 0) rotate(0deg);
		}
		50% {
			transform: translate3d(0, -12px, 0) rotate(5deg);
		}
	}
</style>
