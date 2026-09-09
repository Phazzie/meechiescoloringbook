<!--
Purpose: Coloring-page preview paper, generate/download/copy/vault actions.
Why: Extracted from +page.svelte; parent owns state, this component is purely presentational.
Info flow: Parent passes derived image data and callbacks; user actions propagate via callbacks.
Critical invariant: the paper on screen shows the page's OWN look, never the live controls'. `glitter`
     here is the finished page's glitter — `pageGlitter` in the parent — not the Glitter checkbox.
     This was bound straight to the checkbox, so with a generated page up, ticking the box visibly
     restyled a picture nobody had remade, while the settings panel promised the opposite one panel
     over. Any other look this paper grows must come from the artifact the same way: a value read off
     a control here is a claim about a page that control did not make. With no page on the paper the
     controls are correct to show through, because there the paper is a preview of the next one.
-->
<script lang="ts">
	import AiQuotaLine from '$lib/components/AiQuotaLine.svelte';
	import { getStudioAction } from '$lib/core/meechie-studio';
	import type { StudioTheme } from '$lib/core/meechie-studio';
	import type { MeechieStudioTextOutput } from '$lib/seams/meechie-studio-text-seam/contract';
	import type { PageExport } from '$lib/core/page-exports';
	import PageExportRow from '../PageExportRow.svelte';
	import PrintPageButton from '../PrintPageButton.svelte';
	import SharePageButton from '../SharePageButton.svelte';
	import VaultStatusLine from '../VaultStatusLine.svelte';
	import GenerationFailureNotice from '$lib/components/GenerationFailureNotice.svelte';
	import type { GenerationFailure } from '$lib/core/generation-failure';

	let {
		previewOutput,
		imagePreviews,
		pageExports,
		exportError,
		pageFailure,
		onRetryPage,
		isGenerating,
		textOutput,
		copyStatus,
		vaultStatus,
		canSaveToVault,
		glitter,
		activeTheme,
		pageCaution,
		pageQuotaMessage,
		pageQuotaExhausted,
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
		pageFailure: GenerationFailure | null;
		onRetryPage: () => void;
		isGenerating: boolean;
		textOutput: MeechieStudioTextOutput | null;
		copyStatus: string;
		vaultStatus: string;
		canSaveToVault: boolean;
		/**
		 * Whether the paper wears the sparkle overlay.
		 *
		 * The *page's* glitter, not the Glitter checkbox's. The parent decides which of those two it
		 * is (see `pageGlitter` in `studio-state.svelte.ts`); this was bound straight to the live
		 * control, so toggling it restyled a finished page on screen.
		 */
		glitter: boolean;
		activeTheme: StudioTheme;
		/**
		 * What Meechie said about the verdict this page would be made from, when she flagged it.
		 *
		 * `''` whenever she did not — including when nothing reported a standing at all. Never a
		 * reason to disable the button: the reader owns the decision, and a model that over-used
		 * `blocked` would otherwise switch the studio off. What they were owed is the warning, which
		 * belongs here rather than only up in the verdict card, because this is the button that
		 * spends an image generation.
		 */
		pageCaution: string;
		/**
		 * The server's own allowance for the IMAGE bucket, already worded — the bucket the Create
		 * Coloring Page button below actually spends. The studio's other quota line, over in
		 * `StudioInputPanel`, reports the `text` bucket and always did; it sat above this button for
		 * runs, describing a different bucket on a different window.
		 */
		pageQuotaMessage: string;
		/** The server has said the image bucket cannot fund another page. See `pageQuotaMessage`. */
		pageQuotaExhausted: boolean;
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

	<!--
		The paper on screen is the sheet that prints — the same element, marked, rather than a second
		copy of the picture rendered for the printer. A second copy would be a second answer to
		"which page is this?", free to drift, and would download the image bytes twice.

		Marked only when a generated page is actually on it. Without that condition the demo example
		and the text-only preview would print as though they were the reader's page.
	-->
	<div
		class="paper"
		class:glitter
		data-print-sheet={imagePreviews.length > 0 ? '' : undefined}
	>
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

	<GenerationFailureNotice
		failure={pageFailure}
		onRetry={onRetryPage}
		isBusy={isGenerating}
		testId="home-generation-error"
	/>

	{#if pageCaution}
		<!-- Above the button, not below it: a caution the reader meets after they have already
		     pressed the thing it is about has cost them the generation it was warning them off. -->
		<p class="page-caution" data-testid="home-page-caution" role="status">
			{pageCaution}
		</p>
	{/if}

	<div class="preview-actions">
		<button
			type="button"
			class="primary"
			data-testid="home-create-page"
			onclick={onGeneratePage}
			aria-describedby={pageQuotaMessage ? 'page-budget' : undefined}
			disabled={!textOutput || isGenerating || pageQuotaExhausted}
		>
			{isGenerating ? 'Creating...' : 'Create Coloring Page'}
		</button>
		<AiQuotaLine
			message={pageQuotaMessage}
			testId="home-page-quota"
			id="page-budget"
		/>
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
		<!-- Beside the downloads rather than inside the export list: neither of these is a file you
		     take away. One is the page going straight to paper; the other is the page going straight
		     to somebody else. -->
		<PrintPageButton
			sheetCount={imagePreviews.length}
			pageTitle={previewOutput?.pageTitle ?? null}
			testId="home-print-page"
		/>
		<SharePageButton
			exports={pageExports}
			pageTitle={previewOutput?.pageTitle ?? null}
			quote={previewOutput?.quote ?? null}
			testId="home-share-page"
		/>
	</div>

	<!--
		Every download names itself. This row used to render one hardcoded string — "Download PDF" —
		once per packaged file, so the label said the same thing whatever was behind it and would have
		said it N times over had the studio ever packaged more than one file. Beside it sat a second
		link handing back the provider's raw bytes under a constant filename. What each file is, what
		it is for and how big it is are all read off the file itself now, so the row cannot describe a
		page it is not carrying.

		Now the shared component rather than this panel's own copy: for twelve runs it was this
		panel's own copy, and the twelve other surfaces that make a page kept the raw-filename row
		this one replaced.
	-->
	<PageExportRow exports={pageExports} {exportError} testIdPrefix="home" />

	<!-- One line for both, as before: a copy confirmation and a save confirmation never both
	     need saying, and the save is the one that comes with somewhere to go. -->
	<VaultStatusLine status={copyStatus || vaultStatus} testId="home-status" />
</section>

<style>
	/*
	 * The panel's own frame and buttons are `:global` rules in `+page.svelte`. This is the one thing
	 * new to it. Gold rather than the error pink: nothing has failed, and styling it as a failure
	 * would tell the reader the studio refused them when what happened is that Meechie flagged her
	 * own answer.
	 */
	.page-caution {
		margin: 0 0 0.7rem;
		padding: 0.55rem 0.75rem;
		border-radius: 0.7rem;
		border: 1px solid rgba(201, 162, 39, 0.5);
		background: rgba(7, 7, 15, 0.55);
		color: var(--cream);
		font-size: 0.86rem;
		font-weight: 600;
	}
</style>
