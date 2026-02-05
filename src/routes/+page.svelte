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
	import { driftDetectionAdapter } from '$lib/adapters/drift-detection.adapter';
	import { imageGenerationAdapter } from '$lib/adapters/image-generation.adapter';
	import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
	import { promptAssemblyAdapter } from '$lib/adapters/prompt-assembly.adapter';
	import { sessionAdapter } from '$lib/adapters/session.adapter';
	import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
	import MeechieTools from '$lib/components/MeechieTools.svelte';
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
	let styleHint = 'glam sparkle icons';
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
	let draftStatus = '';
	let isBrowser = false;
	let draftTimer: ReturnType<typeof setTimeout> | null = null;
	let hasValidated = false;
	let isSpecValid = false;

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

	const validateSpec = async (): Promise<boolean> => {
		const validation = await specValidationAdapter.validate({ spec });
		validationIssues = validation.issues;
		hasValidated = true;
		return validation.ok;
	};

	$: isSpecValid = hasValidated && validationIssues.length === 0;

	const handleGenerate = async (): Promise<void> => {
		resetOutputs();
		isGenerating = true;
		const isValid = await validateSpec();
		if (!isValid) {
			generationError = 'Fix validation issues before generating.';
			isGenerating = false;
			return;
		}

		const promptResult = await promptAssemblyAdapter.assemble({
			spec,
			styleHint: styleHint.trim().length > 0 ? styleHint : undefined
		});
		if (!promptResult.ok) {
			generationError = promptResult.error.message;
			isGenerating = false;
			return;
		}
		assembledPrompt = promptResult.value.prompt;

		const imageResult = await imageGenerationAdapter.generate({
			spec,
			prompt: promptResult.value.prompt,
			variations: spec.variations,
			outputFormat: spec.outputFormat
		});
		if (!imageResult.ok) {
			generationError = imageResult.error.message;
			isGenerating = false;
			return;
		}

		images = imageResult.value.images;
		revisedPrompt = imageResult.value.revisedPrompt || '';

		const driftResult = await driftDetectionAdapter.detect({
			spec,
			promptSent: promptResult.value.prompt,
			revisedPrompt: imageResult.value.revisedPrompt
		});
		if (driftResult.ok) {
			violations = driftResult.value.violations;
			recommendedFixes = driftResult.value.recommendedFixes;
		}

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
					assembledPrompt: promptResult.value.prompt,
					revisedPrompt: imageResult.value.revisedPrompt,
					images: storedImages,
					violations: driftResult.ok ? driftResult.value.violations : undefined,
					fixesApplied: driftResult.ok
						? driftResult.value.recommendedFixes.map((fix) => fix.code)
						: undefined,
					authContext,
					owner
				}
			});
			await refreshCreations();
		}

		isGenerating = false;
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
		styleHint = 'glam sparkle icons';
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
	<title>Coloring Book Page Generator</title>
</svelte:head>

<div class="page">
	<header class="hero">
		<div>
			<p class="eyebrow">Seam-Driven Development</p>
			<h1>Coloring Book Page Generator</h1>
			<p class="subhead">
				Deterministic, printable coloring pages with strict layout rules, prompt transparency,
				and drift detection.
			</p>
		</div>
		<div class="hero-card">
			<p class="hero-label">Status</p>
			<div class="status-row">
				<span class="dot" aria-hidden="true"></span>
				<span>Anonymous session ready</span>
			</div>
			<div class="status-row">
				<span class="dot alt" aria-hidden="true"></span>
				<span>{draftStatus || 'Draft idle'}</span>
			</div>
			<button class="ghost" type="button" on:click={resetSpec}>Reset spec</button>
		</div>
	</header>

	<div class="grid">
		<section class="card">
			<h2>Manual Builder</h2>
			<div class="field">
				<label for="title">Title</label>
				<input id="title" type="text" bind:value={spec.title} on:input={scheduleDraftSave} />
			</div>

			<div class="field">
				<label for="listMode">List mode</label>
				<select id="listMode" value={spec.listMode} on:change={handleListModeChange}>
					<option value="list">Title + list</option>
					<option value="title_only">Title only</option>
				</select>
			</div>

			{#if spec.listMode === 'list'}
				<fieldset class="field">
					<legend>Numbered items</legend>
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
				<p class="hint">Title-only mode omits list items and footer.</p>
			{/if}

			<div class="field">
				<label for="dedication">Dedicated to (optional)</label>
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
				<label for="styleHint">Style hint</label>
				<input
					id="styleHint"
					type="text"
					bind:value={styleHint}
					on:input={scheduleDraftSave}
					placeholder="glam icons"
				/>
			</div>

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

			<div class="field-row">
				<div class="field">
					<label for="variations">Variations</label>
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
					<label for="outputFormat">Output</label>
					<select id="outputFormat" bind:value={spec.outputFormat} on:change={scheduleDraftSave}>
						<option value="pdf">PDF</option>
						<option value="png">PNG</option>
					</select>
				</div>
			</div>

			<div class="field">
				<p class="label">Share exports</p>
				<label class="toggle">
					<input type="checkbox" bind:checked={includeSquareExport} />
					<span>Square 1080x1080 (PNG)</span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={includeChatExport} />
					<span>Group chat 720x720 (PNG)</span>
				</label>
			</div>

			<div class="actions">
				<button
					type="button"
					class="primary"
					on:click={handleGenerate}
					disabled={!isSpecValid || isGenerating}
				>
					{isGenerating ? 'Generating...' : 'Generate'}
				</button>
				<button type="button" class="ghost" on:click={validateSpec}>Validate</button>
			</div>

			{#if validationIssues.length > 0}
				<div class="issues">
					<h3>Validation issues</h3>
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
			<h2>Output</h2>
			<label class="toggle">
				<input type="checkbox" bind:checked={showSparkleOverlay} />
				<span>Preview sparkle overlay</span>
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
				<p class="empty">Generate to preview pages.</p>
			{/if}

			{#if packagedFiles.length > 0}
				<div class="downloads">
					<h3>Downloads</h3>
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

	<section class="card">
		<h2>Chat-Assisted Builder</h2>
		<div class="field">
			<label for="chat">Describe your page</label>
			<textarea
				id="chat"
				rows="3"
				bind:value={chatMessage}
				on:input={scheduleDraftSave}
				placeholder="Describe your intent in plain language..."
			></textarea>
		</div>
		<button type="button" class="ghost" on:click={handleChatInterpretation}>
			Interpret intent
		</button>
	</section>

	<section class="card">
		<h2>Prompt + Drift Inspection</h2>
		<div class="field">
			<label for="promptSent">Prompt sent</label>
			<textarea id="promptSent" rows="8" readonly value={assembledPrompt}></textarea>
		</div>
		<div class="field">
			<label for="revisedPrompt">Revised prompt (model)</label>
			<textarea id="revisedPrompt" rows="4" readonly value={revisedPrompt}></textarea>
		</div>
		<div class="field">
			<p class="label">Violations</p>
			{#if violations.length === 0}
				<p class="empty">No violations detected.</p>
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
				<p class="label">Recommended fixes</p>
				<ul>
					{#each recommendedFixes as fix}
						<li>
							<strong>{fix.code}</strong>: {fix.message}
						</li>
					{/each}
				</ul>
			</div>
			<button type="button" class="ghost" on:click={handleGenerate}>
				Apply fixes + regenerate
			</button>
		{/if}
	</section>

	<section class="card">
		<h2>Saved Creations</h2>
		{#if creations.length === 0}
			<p class="empty">No saved creations yet.</p>
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
								{creation.favorite ? 'Unfavorite' : 'Favorite'}
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

	<MeechieTools />
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Fredoka', 'Baloo 2', system-ui, sans-serif;
		color: #1b1b1b;
		background: radial-gradient(circle at top, #fef7ec, #f3efe7 45%, #e8e1d6);
		min-height: 100vh;
	}

	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 3rem 2rem 4rem;
	}

	.hero {
		display: flex;
		gap: 2rem;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2.5rem;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.7rem;
		color: #7b6f61;
		margin-bottom: 0.5rem;
	}

	h1 {
		font-family: 'Baloo 2', cursive;
		font-size: 2.6rem;
		margin: 0 0 0.5rem;
	}

	.subhead {
		max-width: 520px;
		font-size: 1.05rem;
		color: #4b443c;
	}

	.hero-card {
		background: #fff8f1;
		border: 1px solid #e6dacb;
		padding: 1.5rem;
		border-radius: 1rem;
		min-width: 220px;
		box-shadow: 0 14px 30px rgba(125, 107, 87, 0.12);
	}

	.hero-label {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #8e7c6b;
		margin-bottom: 0.5rem;
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
		font-size: 0.9rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #b36f4c;
	}

	.dot.alt {
		background: #4c6f8b;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.card {
		background: #fff;
		border: 1px solid #eadfd0;
		border-radius: 1.25rem;
		padding: 1.5rem;
		box-shadow: 0 18px 45px rgba(120, 96, 72, 0.08);
	}

	.card.preview {
		min-height: 520px;
	}

	h2 {
		margin-top: 0;
		font-size: 1.4rem;
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

	legend {
		font-weight: 600;
		color: #3c332b;
		margin-bottom: 0.4rem;
	}

	.label {
		font-weight: 600;
		color: #3c332b;
		margin: 0;
	}

	.field-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	label {
		font-weight: 600;
		color: #3c332b;
	}

	input,
	select,
	textarea {
		border-radius: 0.75rem;
		border: 1px solid #d8c8b8;
		padding: 0.6rem 0.7rem;
		font-size: 0.95rem;
		font-family: inherit;
		background: #fefcf9;
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
		gap: 0.6rem;
		align-items: center;
		font-weight: 600;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.primary {
		background: #2f2b26;
		color: #fefbf7;
		border: none;
		padding: 0.7rem 1.3rem;
		border-radius: 999px;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 20px rgba(47, 43, 38, 0.2);
	}

	.ghost {
		background: transparent;
		border: 1px solid #cdb9a7;
		color: #4b3d2f;
		padding: 0.55rem 1rem;
		border-radius: 999px;
		cursor: pointer;
	}

	.ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: 0.8rem;
		color: #7a6a5b;
	}

	.issues {
		background: #fff4e8;
		border: 1px solid #f1d2b9;
		padding: 1rem;
		border-radius: 1rem;
	}

	.issues ul {
		margin: 0.5rem 0 0;
		padding-left: 1.2rem;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.preview-grid figure {
		position: relative;
	}

	.preview-grid img {
		width: 100%;
		border-radius: 0.8rem;
		background: #fff;
		border: 1px solid #eadfd0;
	}

	.preview-grid figure.sparkle::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 0.8rem;
		background:
			radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.8), transparent 30%),
			radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.6), transparent 35%),
			radial-gradient(circle at 35% 75%, rgba(255, 255, 255, 0.5), transparent 40%),
			radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.4), transparent 45%);
		opacity: 0.6;
		mix-blend-mode: screen;
		pointer-events: none;
	}

	figcaption {
		font-size: 0.85rem;
		color: #6f6154;
		margin-top: 0.4rem;
		text-align: center;
	}

	.error {
		color: #a33b2b;
		background: #ffe7e1;
		padding: 0.7rem;
		border-radius: 0.8rem;
	}

	.empty {
		color: #7a6a5b;
		font-style: italic;
	}

	.downloads {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.download {
		text-decoration: none;
		color: #2f2b26;
		background: #f6efe7;
		padding: 0.5rem 0.8rem;
		border-radius: 0.8rem;
		border: 1px solid #e4d7c9;
	}

	.creations {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.creation {
		border: 1px solid #eadfd0;
		border-radius: 1rem;
		padding: 1rem;
		background: #fefcf9;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.creation .title {
		font-weight: 600;
		margin-bottom: 0.2rem;
	}

	.creation .meta {
		font-size: 0.75rem;
		color: #7c6d5f;
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
		background: #fce3de;
		color: #c13a36;
	}
	.ghost.danger {
		color: #a33b2b;
		border-color: #a33b2b;
	}

	.success {
		color: #2b6f5a;
	}

	.warning {
		color: #b36f4c;
	}

	@media (max-width: 900px) {
		.hero {
			flex-direction: column;
		}

		.hero-card {
			width: 100%;
		}

		.item-row {
			grid-template-columns: 1fr;
		}
	}
</style>
