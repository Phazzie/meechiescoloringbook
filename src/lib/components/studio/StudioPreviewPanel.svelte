<!--
Purpose: Coloring-page preview paper, generate/download/copy/vault actions.
Why: Extracted from +page.svelte; parent owns state, this component is purely presentational.
Info flow: Parent passes derived image data and callbacks; user actions propagate via callbacks.
-->
<script lang="ts">
	import { getStudioAction } from '$lib/core/meechie-studio';
	import type { StudioTheme } from '$lib/core/meechie-studio';
	import type { MeechieStudioTextOutput } from '$lib/seams/meechie-studio-text-seam/contract';
	import type { PageExport } from '$lib/core/page-exports';

	let {
		previewOutput,
		imagePreviews,
		pageExports,
		exportError,
		generationError,
		isGenerating,
		textOutput,
		copyStatus,
		vaultStatus,
		canSaveToVault,
		glitter,
		activeTheme,
		onGeneratePage,
		onCopyQuote,
		onSaveToVault
	}: {
		previewOutput: MeechieStudioTextOutput | null;
		imagePreviews: string[];
		/** Every way this page can be taken away, each one describing itself. */
		pageExports: PageExport[];
		/** What could not be packaged — never a reason to think the page itself failed. */
		exportError: string;
		generationError: string;
		isGenerating: boolean;
		textOutput: MeechieStudioTextOutput | null;
		copyStatus: string;
		vaultStatus: string;
		canSaveToVault: boolean;
		glitter: boolean;
		activeTheme: StudioTheme;
		onGeneratePage: () => Promise<void>;
		onCopyQuote: () => Promise<void>;
		onSaveToVault: () => Promise<void>;
	} = $props();
</script>

<section class="preview-panel" aria-label="Meechie coloring-page preview">
	<div class="preview-head">
		<div>
			<p class="eyebrow">Preview</p>
			<h2>
				{previewOutput ? previewOutput.pageTitle : 'Your coloring page'}
			</h2>
		</div>
		<img src={activeTheme.image} alt="" />
	</div>

	<div class="paper" class:glitter>
		{#if imagePreviews.length > 0}
			<img
				class="generated-image"
				data-testid="home-generated-image"
				src={imagePreviews[0]}
				alt="Generated Meechie coloring page"
			/>
		{:else if previewOutput}
			<div class="paper-empty">
				<p class="paper-title">{previewOutput.pageTitle}</p>
				<ol>
					{#each previewOutput.pageItems as item}
						<li>{item.label}</li>
					{/each}
				</ol>
				<p class="paper-quote">"{previewOutput.quote}"</p>
			</div>
		{:else}
			<div class="paper-empty paper-idle" data-testid="home-preview-idle">
				<img
					src="/meechie/demo-coloring-page.png"
					alt="Example Meechie coloring page"
					style="width: 100%; border-radius: 8px;"
				/>
				<p class="demo-caption">✨ Example page — generate yours above</p>
			</div>
		{/if}
	</div>

	{#if generationError}
		<p class="error" data-testid="home-generation-error">
			{generationError}
		</p>
	{/if}

	<div class="preview-actions">
		<button
			type="button"
			class="primary"
			data-testid="home-create-page"
			onclick={onGeneratePage}
			disabled={!textOutput || isGenerating}
		>
			{isGenerating ? 'Creating...' : 'Create Coloring Page'}
		</button>
		<button
			type="button"
			data-testid="home-copy-quote"
			onclick={onCopyQuote}
			disabled={!textOutput}>{getStudioAction('copy_quote').label}</button
		>
		<button
			type="button"
			data-testid="home-save-vault"
			onclick={onSaveToVault}
			disabled={!canSaveToVault}
			>{getStudioAction('save_to_vault').label}</button
		>
	</div>

	<!--
		Every download names itself. This row used to render one hardcoded string — "Download PDF" —
		once per packaged file, so the label said the same thing whatever was behind it and would have
		said it N times over had the studio ever packaged more than one file. Beside it sat a second
		link handing back the provider's raw bytes under a constant filename. What each file is, what
		it is for and how big it is are all read off the file itself now, so the row cannot describe a
		page it is not carrying.
	-->
	<!-- Labelled with the same words it shows, so what a screen reader announces and what a sighted
	     reader sees are one string rather than two that can drift apart. -->
	<section class="exports" aria-labelledby="home-export-heading">
		<p class="eyebrow" id="home-export-heading">Take it with you</p>
		{#if pageExports.length > 0}
			<ul class="export-list" data-testid="home-export-list">
				<!-- Deliberately unkeyed. Filenames are unique by construction today, but a key that
				     turns out to be duplicated is a runtime error in Svelte, and this list is three
				     rows long — there is nothing for a key to buy. -->
				{#each pageExports as item}
					<li>
						<a
							class="button-link export-link"
							data-testid="home-export-link"
							data-export-kind={item.kind}
							href={item.href}
							download={item.filename}
						>
							<span class="export-label">{item.label}</span>
							<span class="export-meta">{item.purpose} · {item.sizeLabel}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="export-empty" data-testid="home-export-empty">
				Make a page — its printable PDF, its share image and the original all land
				here.
			</p>
		{/if}
		{#if exportError}
			<!-- A notice, not an error: the page above it is finished and worth keeping. Styled and
			     worded apart from `generationError` so nobody reads a failed PDF as a failed
			     generation and pays for a second one. -->
			<p class="export-notice" data-testid="home-export-error" role="status">
				{exportError}
			</p>
		{/if}
	</section>

	{#if copyStatus || vaultStatus}
		<p class="status" data-testid="home-status">
			{copyStatus || vaultStatus}
		</p>
	{/if}
</section>
