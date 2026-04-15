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
	let creations: CreationRecord[] = [];
	let owner: CreationOwner | null = null;
	let authContext: CreationRecord['authContext'] | null = null;
	let sessionStatus = 'Connecting session...';
	let draftStatus = '';
	let apiKeyInput = '';
	let apiKeyStatus = 'No API key saved.';
	let revealApiKey = false;
	let hasSavedApiKey = false;
	let apiSettingsOpen = true;
	let isBrowser = false;
	let draftTimer: ReturnType<typeof setTimeout> | null = null;
	let hasValidated = false;
	let isSpecValid = false;
	let builderMode: 'quick' | 'full' = 'quick';

	type QuickPresetId = 'minimal' | 'sparkle' | 'story_scene' | 'bold_block';

	const applyQuickPreset = (preset: QuickPresetId): void => {
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
			hasSavedApiKey = false;
			apiSettingsOpen = true;
			return;
		}
		saveStoredApiKey(trimmed);
		apiKeyStatus = 'API key saved in this browser.';
		hasSavedApiKey = true;
		apiSettingsOpen = false;
	};

	const clearApiKey = (): void => {
		apiKeyInput = '';
		if (!isBrowser) {
			return;
		}
		clearStoredApiKey();
		apiKeyStatus = 'API key cleared.';
		hasSavedApiKey = false;
		apiSettingsOpen = true;
	};

	const validateSpec = async (): Promise<boolean> => {
		const validation = await specValidationAdapter.validate({ spec });
		validationIssues = validation.issues;
		hasValidated = true;
		return validation.ok;
	};

	$: isSpecValid = hasValidated && validationIssues.length === 0;

	const ADVANCED_FIELDS = new Set([
		'alignment',
		'numberAlignment',
		'fontStyle',
		'fontSize',
		'strokeWidth',
		'colorMode',
		'pageSize',
		'decorations',
		'illustrations',
		'shading',
		'border',
		'borderThickness',
		'includeFooter',
		'includeSquareExport',
		'includeChatExport'
	]);

	$: hasAdvancedValidationIssues = validationIssues.some((issue) =>
		ADVANCED_FIELDS.has(issue.field)
	);

	const handleGenerate = async (): Promise<void> => {
		resetOutputs();
		isGenerating = true;
		try {
			const isValid = await validateSpec();
			if (!isValid) {
				generationError = 'Fix validation issues before generating.';
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
			generationError = generateError instanceof Error ? generateError.message : 'Generate request failed.';
		} finally {
			isGenerating = false;
		}
	};

	const handleChatInterpretation = async (): Promise<void> => {
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
			hasSavedApiKey = true;
			apiSettingsOpen = false;
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

	<section class="card chat">
		<h2>Just say it</h2>
		<div class="field">
			<label for="chat">Tell Meechie what you want</label>
			<textarea
				id="chat"
				rows="3"
				bind:value={chatMessage}
				on:input={scheduleDraftSave}
				placeholder="Example: glam birthday theme with diamonds, heels, and bold lettering"
			></textarea>
		</div>
		<button type="button" class="primary" on:click={handleChatInterpretation}>
			Make It
		</button>
	</section>

	<p class="or-divider">— or build it yourself —</p>

	<div class="grid">
		<section class="card builder">
			<h2>Build the Look</h2>

			<div class="field">
				<label for="title">Main headline</label>
				<input id="title" type="text" bind:value={spec.title} on:input={scheduleDraftSave} />
			</div>

			<div class="field">
				<label for="listMode">Page layout</label>
				<select id="listMode" value={spec.listMode} on:change={handleListModeChange}>
					<option value="list">Headline + numbered list</option>
					<option value="title_only">Headline only</option>
				</select>
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
								/>
								<button
									type="button"
									class="ghost"
									disabled={spec.items.length <= 1}
									on:click={() => removeItem(index)}
								>
									Remove
								</button>
							</div>
						{/each}
						<button
							type="button"
							class="ghost"
							disabled={spec.items.length >= 20}
							on:click={addItem}
						>
							Add item
						</button>
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
				<p class="hint">Headline-only mode hides list lines and footer text.</p>
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
					<button type="button" class="ghost preset" on:click={() => applyQuickPreset('minimal')}>
						Soft Luxe
					</button>
					<button type="button" class="ghost preset" on:click={() => applyQuickPreset('sparkle')}>
						Diamond Night
					</button>
					<button type="button" class="ghost preset" on:click={() => applyQuickPreset('story_scene')}>
						City Story
					</button>
					<button type="button" class="ghost preset" on:click={() => applyQuickPreset('bold_block')}>
						Boss Energy
					</button>
				</div>
			</div>

			<div class="field-row">
				<div class="field">
					<label for="variations">How many versions</label>
					<input
						id="variations"
						type="number"
						min="1"
						max="4"
						bind:value={spec.variations}
						on:input={scheduleDraftSave}
					/>
				</div>
				<div class="field">
					<label for="outputFormat">Download type</label>
					<select id="outputFormat" bind:value={spec.outputFormat} on:change={scheduleDraftSave}>
						<option value="pdf">PDF</option>
						<option value="png">PNG</option>
					</select>
				</div>
			</div>

			<div class="actions">
				<button
					type="button"
					class="primary"
					on:click={handleGenerate}
					disabled={!isSpecValid || isGenerating}
				>
					{isGenerating ? 'Creating...' : 'Create Pages'}
				</button>
				<button type="button" class="ghost" on:click={resetSpec}>Reset</button>
			</div>
			{#if !hasSavedApiKey}
				<p class="api-key-hint">
					An API key is required. Expand <strong>API Key Settings</strong> below to add one.
				</p>
			{/if}

			<details class="advanced-toggle" bind:open={hasAdvancedValidationIssues}>
				<summary>More controls</summary>
				<div class="advanced-content">
					<div class="field-row">
						<div class="field">
							<label for="alignment">Alignment</label>
							<select id="alignment" bind:value={spec.alignment} on:change={scheduleDraftSave}>
								<option value="left">Left</option>
								<option value="center">Center</option>
							</select>
						</div>
						<div class="field">
							<label for="numberAlignment">Number alignment</label>
							<select id="numberAlignment" bind:value={spec.numberAlignment} on:change={scheduleDraftSave}>
								<option value="strict">Strict</option>
								<option value="loose">Loose</option>
							</select>
						</div>
						<div class="field">
							<label for="listGutter">List gutter</label>
							<select
								id="listGutter"
								bind:value={spec.listGutter}
								on:change={scheduleDraftSave}
								disabled={spec.listMode === 'title_only'}
							>
								<option value="tight">Tight</option>
								<option value="normal">Normal</option>
								<option value="loose">Loose</option>
							</select>
						</div>
					</div>

					<div class="field-row">
						<div class="field">
							<label for="whitespaceScale">Whitespace scale</label>
							<input
								id="whitespaceScale"
								type="range"
								min="0"
								max="100"
								bind:value={spec.whitespaceScale}
								on:input={scheduleDraftSave}
							/>
							<span class="hint">{spec.whitespaceScale}</span>
						</div>
						<div class="field">
							<label for="textSize">Text size</label>
							<select id="textSize" bind:value={spec.textSize} on:change={scheduleDraftSave}>
								<option value="small">Small</option>
								<option value="medium">Medium</option>
								<option value="large">Large</option>
							</select>
						</div>
						<div class="field">
							<label for="fontStyle">Font style</label>
							<select id="fontStyle" bind:value={spec.fontStyle} on:change={scheduleDraftSave}>
								<option value="rounded">Rounded</option>
								<option value="block">Block</option>
								<option value="hand">Handwritten</option>
							</select>
						</div>
					</div>

					<div class="field-row">
						<div class="field">
							<label for="textStrokeWidth">Text stroke width</label>
							<input
								id="textStrokeWidth"
								type="range"
								min="4"
								max="12"
								bind:value={spec.textStrokeWidth}
								on:input={scheduleDraftSave}
							/>
							<span class="hint">{spec.textStrokeWidth}px</span>
						</div>
						<div class="field">
							<label for="colorMode">Color mode</label>
							<select id="colorMode" bind:value={spec.colorMode} on:change={scheduleDraftSave}>
								<option value="black_and_white_only">Black + white</option>
								<option value="grayscale">Grayscale</option>
								<option value="color">Color</option>
							</select>
						</div>
						<div class="field">
							<label for="pageSize">Page size</label>
							<select id="pageSize" bind:value={spec.pageSize} on:change={scheduleDraftSave}>
								<option value="US_Letter">US Letter</option>
								<option value="A4">A4</option>
							</select>
						</div>
					</div>

					<div class="field-row">
						<div class="field">
							<label for="decorations">Interior decorations</label>
							<select id="decorations" bind:value={spec.decorations} on:change={scheduleDraftSave}>
								<option value="none">None</option>
								<option value="minimal">Minimal</option>
								<option value="dense">Dense</option>
							</select>
						</div>
						<div class="field">
							<label for="illustrations">Illustrations</label>
							<select id="illustrations" bind:value={spec.illustrations} on:change={scheduleDraftSave}>
								<option value="none">None</option>
								<option value="simple">Simple</option>
								<option value="scene">Scene</option>
							</select>
						</div>
						<div class="field">
							<label for="shading">Shading</label>
							<select id="shading" bind:value={spec.shading} on:change={scheduleDraftSave}>
								<option value="none">None</option>
								<option value="hatch">Hatch</option>
								<option value="stippling">Stippling</option>
							</select>
						</div>
					</div>

					<div class="field-row">
						<div class="field">
							<label for="border">Border</label>
							<select id="border" bind:value={spec.border} on:change={scheduleDraftSave}>
								<option value="none">None</option>
								<option value="plain">Plain</option>
								<option value="decorative">Decorative</option>
							</select>
						</div>
						<div class="field">
							<label for="borderThickness">Border thickness</label>
							<input
								id="borderThickness"
								type="range"
								min="2"
								max="16"
								bind:value={spec.borderThickness}
								on:input={scheduleDraftSave}
							/>
							<span class="hint">{spec.borderThickness}px</span>
						</div>
					</div>

					<div class="field">
						<p class="label">Social add-ons</p>
						<label class="toggle">
							<input type="checkbox" bind:checked={includeSquareExport} />
							<span>Instagram square 1080x1080</span>
						</label>
						<label class="toggle">
							<input type="checkbox" bind:checked={includeChatExport} />
							<span>Chat share 720x720</span>
						</label>
					</div>
				</div>
			</details>

			{#if validationIssues.length > 0}
				<div class="issues">
					<h3>Fix these first</h3>
					<ul>
						{#each validationIssues as issue}
							<li>
								<strong>{issue.field}</strong>: {issue.message}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>

		<section class="card preview">
			<h2>Preview + Export</h2>
			<label class="toggle">
				<input type="checkbox" bind:checked={showSparkleOverlay} />
				<span>Add glitter preview glow</span>
			</label>
			{#if generationError}
				<p class="error">{generationError}</p>
			{/if}
			{#if imagePreviews.length > 0}
				<div class="preview-grid">
					{#each imagePreviews as preview, index}
						<figure class:sparkle={showSparkleOverlay}>
							<img src={preview} alt={`Generated page ${index + 1}`} />
							<figcaption>Variation {index + 1}</figcaption>
						</figure>
					{/each}
				</div>
			{:else}
				<p class="empty">Press Create Pages to see your results.</p>
			{/if}

			{#if packagedFiles.length > 0}
				<div class="downloads">
					<h3>Ready to download</h3>
					{#each packagedFiles as file}
						<a
							class="download"
							href={`data:${file.mimeType};base64,${file.dataBase64}`}
							download={file.filename}
						>
							{file.filename}
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<details class="card advanced-card">
		<summary>System Trace (Advanced)</summary>
		<div class="advanced-content">
			<div class="field">
				<label for="promptSent">Prompt used</label>
				<textarea id="promptSent" rows="8" readonly value={assembledPrompt}></textarea>
			</div>
			<div class="field">
				<label for="revisedPrompt">Model rewrite</label>
				<textarea id="revisedPrompt" rows="4" readonly value={revisedPrompt}></textarea>
			</div>
			<div class="field">
				<p class="label">Quality flags</p>
				{#if violations.length === 0}
					<p class="empty">No quality flags detected.</p>
				{:else}
					<ul>
						{#each violations as violation}
							<li class={violation.severity}>
								<strong>{violation.code}</strong>: {violation.message}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			{#if recommendedFixes.length > 0}
				<div class="field">
					<p class="label">Recommended auto-fixes</p>
					<ul>
						{#each recommendedFixes as fix}
							<li>
								<strong>{fix.code}</strong>: {fix.message}
							</li>
						{/each}
					</ul>
				</div>
				<button type="button" class="ghost" on:click={handleGenerate}>
					Apply fixes + try again
				</button>
			{/if}
		</div>
	</details>

	<section class="card history">
		<h2>Your Vault</h2>
		{#if creations.length === 0}
			<p class="empty">No saved looks yet.</p>
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
							>
								Load
							</button>
							<button type="button" class="ghost" on:click={() => toggleFavorite(creation)}>
								{creation.favorite ? 'Unpin' : 'Pin'}
							</button>
							<button type="button" class="ghost danger" on:click={() => handleDeleteCreation(creation.id)}>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card meechie-link-card">
		<h2>Meechie Tools</h2>
		<p class="meechie-link-copy">
			Need a clapback, a receipt check, or a cold read on the situation? Open the dedicated Meechie
			space.
		</p>
		<a class="primary meechie-link-button" href="/meechie">Go To Meechie Tools</a>
	</section>

	<details class="card api-settings" bind:open={apiSettingsOpen}>
		<summary>API Key Settings</summary>
		<div class="advanced-content">
			<p class="api-key-label">Paste your API key to generate pages</p>
			<input
				type={revealApiKey ? 'text' : 'password'}
				bind:value={apiKeyInput}
				placeholder="Paste key here"
				autocomplete="off"
				spellcheck="false"
			/>
			<div class="api-key-actions">
				<button type="button" class="ghost tiny" on:click={saveApiKey}>Save</button>
				<button type="button" class="ghost tiny" on:click={clearApiKey}>Clear</button>
				<button type="button" class="ghost tiny" on:click={() => (revealApiKey = !revealApiKey)}>
					{revealApiKey ? 'Hide' : 'Show'}
				</button>
			</div>
			<p class="api-key-status">{apiKeyStatus}</p>
		</div>
	</details>

	<div class="mobile-actions" aria-label="Quick actions">
		<button
			type="button"
			class="primary mobile-primary"
			on:click={handleGenerate}
			disabled={!isSpecValid || isGenerating}
		>
			{isGenerating ? 'Creating...' : 'Create Pages'}
		</button>
		{#if !hasSavedApiKey}
			<p class="api-key-hint">API key required — expand <strong>API Key Settings</strong> above.</p>
		{/if}
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
		color-scheme: dark;
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

	.or-divider {
		position: relative;
		z-index: 1;
		text-align: center;
		margin: 0 0 1.4rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(184, 170, 207, 0.5);
	}

	.grid {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(340px, 1.5fr) minmax(300px, 1fr);
		gap: 1.4rem;
		margin-bottom: 1.5rem;
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

	.card.preview {
		min-height: 520px;
		background: var(--dark-card-alt);
	}

	.chat {
		position: relative;
		z-index: 1;
		margin-bottom: 0.5rem;
		background: linear-gradient(160deg, rgba(232, 0, 106, 0.08), rgba(22, 20, 42, 0.95));
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

	.issues ul {
		margin: 0.5rem 0 0;
		padding-left: 1.2rem;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 1rem;
	}

	.preview-grid figure {
		position: relative;
	}

	.preview-grid img {
		width: 100%;
		border-radius: 0.82rem;
		border: 1px solid var(--gold-border);
		background: #1c1932;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
	}

	.preview-grid figure.sparkle::after {
		content: '';
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

	.downloads {
		margin-top: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.download {
		text-decoration: none;
		font-weight: 700;
		color: var(--gold-bright);
		background: rgba(201, 162, 39, 0.1);
		border: 1px solid var(--gold-border);
		padding: 0.52rem 0.78rem;
		border-radius: 0.78rem;
		transition: background 0.2s ease;
	}

	.download:hover {
		background: rgba(201, 162, 39, 0.18);
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

	.success {
		color: var(--emerald);
	}

	li.error {
		color: #ff6b8a;
	}

	.warning {
		color: var(--gold-bright);
	}

	.meechie-link-card {
		position: relative;
		z-index: 1;
		text-align: left;
	}

	.meechie-link-copy {
		margin: 0 0 1rem;
		color: var(--lavender);
	}

	.meechie-link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
	}

	.advanced-card {
		position: relative;
		z-index: 1;
	}

	.advanced-card summary,
	.api-settings summary {
		cursor: pointer;
		list-style: none;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-style: italic;
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--cream);
	}

	.advanced-card summary::-webkit-details-marker,
	.api-settings summary::-webkit-details-marker {
		display: none;
	}

	.advanced-card summary::after,
	.api-settings summary::after {
		content: 'Show ›';
		float: right;
		font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.advanced-card[open] summary::after,
	.api-settings[open] summary::after {
		content: 'Hide ‹';
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

	.api-settings {
		position: relative;
		z-index: 1;
	}

	.api-key-label {
		margin: 0 0 0.6rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
		display: block;
	}

	.api-key-actions {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.45rem;
		flex-wrap: wrap;
	}

	.api-key-status {
		margin: 0.5rem 0 0;
		font-size: 0.76rem;
		color: var(--lavender);
	}

	.api-key-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--lavender);
	}

	.mobile-actions {
		display: none;
	}

	@media (max-width: 900px) {
		h1 {
			max-width: none;
		}

		.grid {
			grid-template-columns: 1fr;
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
