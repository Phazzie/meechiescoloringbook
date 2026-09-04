<!--
Purpose: Embed Meechie tools inside the main app flow, and turn any verdict into a coloring page.
Why: Keep non-technical users in one place while reusing seam-backed tools. Every tool here used
     to dead-end at a paragraph of text, which in a coloring book app is the whole product
     missing, so each verdict now prints, downloads, and saves to the vault.
Info flow: User inputs -> MeechieToolSeam -> verdict -> tool page recipe -> /api/generate ->
           preview + packaged files -> CreationStoreSeam.
-->
<script lang="ts">
	import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
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
	import type { PackagedFile } from '../../../contracts/output-packaging.contract';
	import type { CreationOwner } from '../../../contracts/creation-store.contract';
	import { GenerateResultSchema } from '../../../contracts/generate.contract';
	import type { GenerateResponseValue } from '../../../contracts/generate.contract';
	import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
	import { creationStoreAdapter } from '$lib/adapters/creation-store.adapter';
	import { sessionAdapter } from '$lib/adapters/session.adapter';
	import { buildToolPageRecipe, buildToolStudioText } from '$lib/core/tool-page-recipe';
	import type { ToolPageRecipe } from '$lib/core/tool-page-recipe';

	// `format` is the only image-type field the contract actually constrains: it is a closed
	// four-value enum, while `mimeType` is `NonEmptyStringSchema`, so any non-empty string passes
	// validation. Deriving the media type from the enum is therefore total and cannot forward an
	// unvalidated wire value.
	const IMAGE_MIME_TYPES: Record<GeneratedImage['format'], string> = {
		svg: 'image/svg+xml',
		png: 'image/png',
		jpg: 'image/jpeg',
		webp: 'image/webp'
	};

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
	const toolsById = Object.fromEntries(tools.map((tool) => [tool.id, tool])) as Record<
		ToolId,
		Tool
	>;

	let selectedTool: ToolId = tools[0].id;
	let output: MeechieToolOutput | null = null;
	let error = '';
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
	let generateError = '';
	let imagePreviews: string[] = [];
	let packagedFiles: PackagedFile[] = [];
	let generatedImages: GeneratedImage[] = [];
	let assembledPrompt = '';
	let revisedPrompt = '';
	// Drift diagnostics from `/api/generate`. The provider's revised prompt can drop an exact-text
	// or layout requirement; discarding these would present a drifted page as a clean one and lose
	// the evidence for good. Surfaced below the preview and persisted with the saved page, which is
	// what the studio flow does.
	let violations: GenerateResponseValue['violations'] = [];
	let recommendedFixes: GenerateResponseValue['recommendedFixes'] = [];
	let lastRecipe: ToolPageRecipe | null = null;
	// The verdict the currently displayed page was built from. Kept separate from `output`, which
	// changes the moment the user switches tools or asks for a new take.
	let pageVerdict: MeechieToolOutput | null = null;
	// Incremented whenever the displayed page stops being current. An in-flight generation
	// compares its own token against this and discards itself if it lost the race.
	let pageToken = 0;
	let dedicatedTo = '';
	let copyStatus = '';
	let vaultStatus = '';
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
	const resetPage = (): void => {
		pageToken += 1;
		isGenerating = false;
		generateError = '';
		imagePreviews = [];
		packagedFiles = [];
		generatedImages = [];
		assembledPrompt = '';
		revisedPrompt = '';
		violations = [];
		recommendedFixes = [];
		lastRecipe = null;
		pageVerdict = null;
		vaultStatus = '';
		copyStatus = '';
	};

	const resetState = (): void => {
		error = '';
		output = null;
		resetPage();
	};

	/**
	 * The dedication is baked into the spec at generation time, so editing it after a page exists
	 * leaves a page, a download and a vault record carrying the previous value while the form shows
	 * the new one. Drop the generated page instead, so the only thing on offer matches the field.
	 */
	const handleDedicationInput = (): void => {
		if (lastRecipe === null && imagePreviews.length === 0) return;
		resetPage();
	};

	const previewUrl = (image: GeneratedImage): string | null => {
		if (image.format === 'svg' && image.encoding === 'utf8') {
			return `data:${IMAGE_MIME_TYPES.svg};utf8,${encodeURIComponent(image.data)}`;
		}
		if (image.encoding === 'base64') {
			return `data:${IMAGE_MIME_TYPES[image.format]};base64,${image.data}`;
		}
		return null;
	};

	const handleMakePage = async (): Promise<void> => {
		if (!output || isGenerating) return;
		// `resetPage` first: it bumps the token, so this run claims the value it leaves behind and
		// any earlier in-flight run is already stale by the time this one starts.
		resetPage();
		isGenerating = true;

		// Pin the verdict this run belongs to, and take a token for it.
		//
		// `/api/generate` is slow enough to switch tools underneath, and `resetState()` sets
		// `output` to null on the way. Without this, a response arriving late would repopulate the
		// page state beneath a different verdict — showing and saving tool A's image under tool B's
		// words — and reading `output.toolId` after the await would throw outright once `output`
		// had been cleared. Everything below reads `verdict` and re-checks the token instead.
		const verdict = output;
		const token = pageToken;
		const isStale = (): boolean => token !== pageToken;
		const recipe = buildToolPageRecipe(verdict, { dedication: dedicatedTo });
		try {
			const payload = await postJson(
				'/api/generate',
				{ spec: recipe.spec, styleHint: recipe.styleHint },
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.generate }
			);
			if (isStale()) return;
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				generateError = 'Generate response did not match contract.';
				return;
			}
			if (!parsed.data.ok) {
				generateError = parsed.data.error.message;
				return;
			}

			const images = parsed.data.value.images;
			// Packaging needs a browser canvas for some formats, so treat a failure as a missing
			// download rather than a failed generation: the page still previews and still saves.
			const packResult = await outputPackagingAdapter.package({
				images,
				outputFormat: 'pdf',
				fileBaseName: `meechie-${verdict.toolId}-${Date.now()}`,
				pageSize: recipe.spec.pageSize,
				variants: ['print', 'square']
			});
			if (isStale()) return;

			pageVerdict = verdict;
			lastRecipe = recipe;
			generatedImages = images;
			assembledPrompt = parsed.data.value.prompt;
			revisedPrompt = parsed.data.value.revisedPrompt ?? '';
			violations = parsed.data.value.violations;
			recommendedFixes = parsed.data.value.recommendedFixes;
			imagePreviews = images
				.map(previewUrl)
				.filter((url): url is string => url !== null);
			if (packResult.ok) {
				packagedFiles = packResult.value.files;
			} else {
				generateError = `Page made, but the download could not be built: ${packResult.error.message}`;
			}
		} catch (requestError) {
			if (isStale()) return;
			generateError =
				requestError instanceof Error
					? requestError.message
					: 'Network error. Try again.';
		} finally {
			if (!isStale()) isGenerating = false;
		}
	};

	/** The vault stores image bytes as base64; utf8 SVG markup has to be encoded before it goes in. */
	const encodeBase64 = (value: string): string => {
		const bytes = new TextEncoder().encode(value);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
	};

	const handleSaveToVault = async (): Promise<void> => {
		if (isSaving || !lastRecipe || !pageVerdict || generatedImages.length === 0) return;
		if (!owner) {
			vaultStatus = 'Session is still connecting. Try again in a moment.';
			return;
		}
		isSaving = true;
		vaultStatus = 'Saving...';
		// Same staleness rule as generation: the record below is built synchronously from the
		// current page, but the write is awaited, so its status must not be painted over a page
		// the user has since replaced.
		const token = pageToken;
		try {
			const result = await creationStoreAdapter.saveCreation({
				record: {
					id:
						typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
							? crypto.randomUUID()
							: `creation-${Date.now()}`,
					createdAtISO: new Date().toISOString(),
					intent: lastRecipe.spec,
					assembledPrompt,
					revisedPrompt: revisedPrompt || undefined,
					// Store the verdict's own text. Leaving this unset is not neutral: the reopen
					// path falls back to `assembledPrompt` for the quote, which on a generated page
					// is the image-generation prompt, and to the default landlord page items when
					// the saved spec has none. See `buildToolStudioText`.
					studioText: buildToolStudioText(pageVerdict, lastRecipe),
					violations,
					fixesApplied: recommendedFixes.map((fix) => fix.code),
					images: generatedImages.map((image) => ({
						b64: image.encoding === 'base64' ? image.data : encodeBase64(image.data)
					})),
					owner
				}
			});
			if (token !== pageToken) return;
			vaultStatus = result.ok
				? 'Saved to the vault. Find it on the home page.'
				: result.error.message;
		} catch (saveError) {
			if (token !== pageToken) return;
			vaultStatus =
				saveError instanceof Error ? saveError.message : 'Failed to save to vault.';
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
			await navigator.clipboard.writeText(`${verdict.headline}\n\n${verdict.response}`);
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

	const handleGenerate = async (): Promise<void> => {
		resetState();
		isWorking = true;
		const parsedInput = MeechieToolInputSchema.safeParse(buildInput());
		if (!parsedInput.success) {
			error = 'Please complete the required fields before generating.';
			isWorking = false;
			return;
		}

		try {
			const payload = await postJson('/api/tools', parsedInput.data, {
				timeoutMs: POST_JSON_TIMEOUTS_MS.tools
			});
			const parsedResult = MeechieToolResultSchema.safeParse(payload);
			if (!parsedResult.success) {
				error = 'Tool response did not match contract.';
				return;
			}

			if (parsedResult.data.ok) {
				output = parsedResult.data.value;
			} else {
				error = parsedResult.data.error.message;
			}
		} catch (requestError) {
			error =
				requestError instanceof Error
					? requestError.message
					: 'Tool request failed.';
		} finally {
			isWorking = false;
		}
	};
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
			disabled={isWorking}
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
	</section>

	{#if error}
		<p class="error" data-testid="meechie-tool-error">{error}</p>
	{/if}

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
					<span class="status" data-testid="meechie-tool-copy-status">{copyStatus}</span>
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
				<label class="label" for="tool-dedication">Dedicated to (optional)</label>
				<input
					id="tool-dedication"
					data-testid="meechie-tool-dedication"
					bind:value={dedicatedTo}
					on:input={handleDedicationInput}
					maxlength="60"
					placeholder="He had time to know better."
				/>
			</div>

			{#if generateError}
				<p class="error" data-testid="meechie-tool-generate-error">{generateError}</p>
			{/if}

			<button
				class="primary"
				type="button"
				data-testid="meechie-tool-make-page"
				on:click={handleMakePage}
				disabled={isGenerating}
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

			{#if violations.length > 0}
				<div class="drift" data-testid="meechie-tool-violations">
					<p class="drift-title">The page drifted from what was asked for</p>
					<ul>
						{#each violations as violation}
							<li>{violation.message}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if imagePreviews.length > 0}
				<div class="preview-grid" data-testid="meechie-tool-preview">
					{#each imagePreviews as preview}
						<figure>
							<img src={preview} alt="Meechie coloring page" />
						</figure>
					{/each}
				</div>

				<div class="page-actions">
					{#each packagedFiles as file}
						<a
							class="download-link"
							data-testid="meechie-tool-download"
							href={`data:${file.mimeType};base64,${file.dataBase64}`}
							download={file.filename}
						>
							{file.filename}
						</a>
					{/each}
					<button
						class="ghost"
						type="button"
						data-testid="meechie-tool-save-vault"
						on:click={handleSaveToVault}
						disabled={isSaving}
					>
						{isSaving ? 'Saving…' : 'Save to the vault'}
					</button>
				</div>
				{#if vaultStatus}
					<p class="status" data-testid="meechie-tool-vault-status">{vaultStatus}</p>
				{/if}
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

	.error {
		color: #ff8ab3;
		font-weight: 600;
		background: rgba(232, 0, 106, 0.1);
		border-radius: 4px;
		padding: 0.7rem 0.9rem;
		border: 1px solid rgba(232, 0, 106, 0.3);
		font-size: 0.9rem;
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

	.drift {
		border-radius: 4px;
		padding: 0.7rem 0.9rem;
		background: rgba(201, 162, 39, 0.09);
		border: 1px solid rgba(201, 162, 39, 0.35);
		color: rgba(253, 246, 227, 0.88);
		font-size: 0.87rem;
	}

	.drift-title {
		margin: 0 0 0.35rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 0.78rem;
		color: var(--gold-bright, #f0c44a);
	}

	.drift ul {
		margin: 0;
		padding-left: 1.1rem;
		line-height: 1.5;
	}

	.page-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.download-link {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		padding: 0.38rem 0.75rem;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.3);
		color: var(--gold-bright, #f0c44a);
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.download-link:hover {
		border-color: rgba(201, 162, 39, 0.6);
		background: rgba(201, 162, 39, 0.07);
	}

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
