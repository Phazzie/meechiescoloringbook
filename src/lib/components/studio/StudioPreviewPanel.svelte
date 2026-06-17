<!--
Purpose: Coloring-page preview paper, generate/download/copy/vault actions.
Why: Extracted from +page.svelte; parent owns state, this component is purely presentational.
Info flow: Parent passes derived image data and callbacks; user actions propagate via callbacks.
-->
<script lang="ts">
	import { getStudioAction } from '$lib/core/meechie-studio';
	import type { StudioTheme } from '$lib/core/meechie-studio';
	import type { MeechieStudioTextOutput } from '../../../../contracts/meechie-studio-text.contract';
	import type { PackagedFile } from '../../../../contracts/output-packaging.contract';

	let {
		previewOutput,
		imagePreviews,
		packagedFiles,
		generationError,
		isGenerating,
		textOutput,
		copyStatus,
		vaultStatus,
		isSaving,
		glitter,
		activeTheme,
		onGeneratePage,
		onCopyQuote,
		onSaveToVault
	}: {
		previewOutput: MeechieStudioTextOutput | null;
		imagePreviews: string[];
		packagedFiles: PackagedFile[];
		generationError: string;
		isGenerating: boolean;
		textOutput: MeechieStudioTextOutput | null;
		copyStatus: string;
		vaultStatus: string;
		isSaving: boolean;
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
					class="demo-image"
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
		{#if packagedFiles.length > 0}
			{#each packagedFiles as file}
				<a
					class="button-link"
					href={`data:${file.mimeType};base64,${file.dataBase64}`}
					download={file.filename}
				>
					{getStudioAction('download_pdf').label}
				</a>
			{/each}
		{:else}
			<button type="button" disabled
				>{getStudioAction('download_pdf').label}</button
			>
		{/if}
		{#if imagePreviews[0]}
			<a
				class="button-link"
				href={imagePreviews[0]}
				download="meechie-coloring-page.png"
			>
				{getStudioAction('export_png').label}
			</a>
		{:else}
			<button type="button" disabled
				>{getStudioAction('export_png').label}</button
			>
		{/if}
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
			disabled={!textOutput || isSaving}
			>{getStudioAction('save_to_vault').label}</button
		>
	</div>

	{#if copyStatus || vaultStatus}
		<p class="status" data-testid="home-status">
			{copyStatus || vaultStatus}
		</p>
	{/if}
</section>
