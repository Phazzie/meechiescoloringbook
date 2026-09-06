<!--
Purpose: The "put it on paper" half of a mode route — dedication, generation, preview, drift
         report, downloads, and the save that puts the page in the Quote Vault.
Why: The three standalone mode routes each owned a private copy of this markup, and each copy was
     missing something different. Sharing it means every mode gets the drift report, the split
     print/share downloads, and the vault save that only the studio and the tools hub had, and a
     fix to any of them lands on all three at once.
Info flow: VerdictPageState (props) -> user actions -> state methods -> reactive redraw.
-->
<script lang="ts">
	import type { VerdictPageState } from './verdict-page-state.svelte';
	import { describeQualityReport } from '$lib/core/quality-report';

	let {
		studio,
		heading = 'Make the coloring page',
		subheading = 'Print it. Color it. Send it to whoever needs to see it.',
		dedicationPlaceholder = 'He had time to know better.'
	}: {
		studio: VerdictPageState;
		heading?: string;
		subheading?: string;
		dedicationPlaceholder?: string;
	} = $props();

	let glitter = $state(false);
</script>

<section class="page-factory" data-testid="verdict-page-factory">
	<div class="factory-head">
		<div>
			<p class="eyebrow">Put It On Paper</p>
			<h2>{heading}</h2>
			<p class="factory-sub">{subheading}</p>
		</div>
		<div class="verdict-tools">
			<button
				class="ghost"
				type="button"
				data-testid="verdict-page-copy"
				onclick={() => studio.copyVerdict()}
			>
				Copy the verdict
			</button>
			{#if studio.copyStatus}
				<span class="status" data-testid="verdict-page-copy-status"
					>{studio.copyStatus}</span
				>
			{/if}
		</div>
	</div>

	<div class="field">
		<label class="field-label" for="verdict-page-dedication"
			>Dedicated to (optional)</label
		>
		<input
			id="verdict-page-dedication"
			data-testid="verdict-page-dedication"
			type="text"
			value={studio.dedication}
			oninput={(event) => studio.setDedication(event.currentTarget.value)}
			maxlength="60"
			placeholder={dedicationPlaceholder}
		/>
	</div>

	<label class="sparkle-toggle">
		<input type="checkbox" bind:checked={glitter} />
		<span>Glitter preview overlay</span>
	</label>

	{#if studio.generateError}
		<p class="error" data-testid="verdict-page-generate-error">
			{studio.generateError}
		</p>
	{/if}

	<!-- Disabled while a replacement verdict is loading too, not just while generating: the page
	     this would produce belongs to the verdict about to be replaced, and would be discarded the
	     moment the replacement lands — after the generation had been billed. -->
	<button
		class="cta"
		type="button"
		data-testid="verdict-page-generate"
		onclick={() => studio.makePage()}
		disabled={studio.isGenerating || studio.isWorking}
	>
		{studio.isGenerating ? 'Printing the truth…' : 'Generate My Coloring Page'}
	</button>

	{#if studio.qualityReport.state === 'flagged'}
		<div class="drift" data-testid="verdict-page-violations">
			<p class="drift-title">{describeQualityReport(studio.qualityReport)}</p>
			<ul>
				<!-- Deliberately unkeyed: `code` is not unique across findings (two lines can
				     breach the same rule), and a duplicate key is a runtime error in Svelte. -->
				{#each studio.qualityReport.findings as finding}
					<li class={finding.weight} data-code={finding.code}>
						<span class="tag"
							>{#if finding.weight === 'blocker'}Wrong{:else if finding.weight === 'note'}Noted{:else}Unchecked{/if}</span
						>
						<span>{finding.message}</span>
					</li>
				{/each}
			</ul>

			{#if studio.qualityReport.fixes.length > 0}
				<!-- Two lists, not one annotated list. The drift seam returns violations and fixes as
				     independent arrays with no promised pairing between them, so showing a fix under
				     a finding would assert a link the contract never made. -->
				<p class="drift-title fixes-title">What closes it</p>
				<ul class="fixes" data-testid="verdict-page-fixes">
					{#each studio.qualityReport.fixes as fix}
						<li>{fix}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if studio.imagePreviews.length > 0}
		<div class="preview-grid" data-testid="verdict-page-preview">
			<!-- Unkeyed for the same reason: two variations of one spec can render byte-identical. -->
			{#each studio.imagePreviews as preview}
				<figure class:sparkle={glitter}>
					<img src={preview} alt="Meechie coloring page" />
				</figure>
			{/each}
		</div>

		<div class="page-actions">
			{#each studio.packagedFiles as file}
				<a
					class="download-link"
					data-testid="verdict-page-download"
					href={`data:${file.mimeType};base64,${file.dataBase64}`}
					download={file.filename}
				>
					{file.filename}
				</a>
			{/each}
			<button
				class="ghost"
				type="button"
				data-testid="verdict-page-save-vault"
				onclick={() => studio.saveToVault()}
				disabled={!studio.canSaveToVault}
			>
				{studio.isSaving ? 'Saving…' : 'Save to the vault'}
			</button>
		</div>
		{#if studio.vaultStatus}
			<p class="status" data-testid="verdict-page-vault-status">
				{studio.vaultStatus}
			</p>
		{/if}
	{/if}
</section>

<style>
	.page-factory {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.factory-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--fuchsia, #e8006a);
	}

	h2 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: 1.6rem;
		font-style: italic;
		font-weight: 800;
		color: var(--cream, #fdf6e3);
	}

	.factory-sub {
		margin: 0;
		font-size: 0.9rem;
		color: var(--lavender, #b8aacf);
	}

	.verdict-tools {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold, #c9a227);
	}

	input[type='text'] {
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		padding: 0.65rem 0.8rem;
		font-size: 0.95rem;
		font-family: inherit;
		color: var(--cream, #fdf6e3);
		background: rgba(7, 7, 15, 0.7);
		transition: border-color 0.2s ease;
	}

	input[type='text']:focus {
		outline: none;
		border-color: var(--gold, #c9a227);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.15);
	}

	input[type='text']::placeholder {
		color: rgba(184, 170, 207, 0.4);
	}

	.sparkle-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.87rem;
		color: var(--lavender, #b8aacf);
		cursor: pointer;
	}

	.cta {
		width: 100%;
		border: none;
		border-radius: 999px;
		padding: 1rem 1.6rem;
		background: linear-gradient(112deg, #e8006a, #6b21a8 55%, #c9a227);
		color: #fff;
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
	}

	.cta:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 16px 36px rgba(232, 0, 106, 0.4);
		filter: saturate(1.1) brightness(1.05);
	}

	.cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ghost {
		background: transparent;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		border-radius: 999px;
		padding: 0.5rem 1rem;
		color: var(--gold-bright, #f0c44a);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	.ghost:hover:not(:disabled) {
		border-color: var(--gold, #c9a227);
	}

	.ghost:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.status {
		margin: 0;
		font-size: 0.82rem;
		color: var(--lavender, #b8aacf);
	}

	.error {
		margin: 0;
		padding: 0.7rem 1rem;
		border-radius: 0.6rem;
		background: rgba(232, 0, 106, 0.1);
		border: 1px solid rgba(232, 0, 106, 0.3);
		font-size: 0.88rem;
		color: #ff8fab;
	}

	.drift {
		padding: 0.8rem 1rem;
		border-radius: 0.6rem;
		border: 1px solid rgba(201, 162, 39, 0.35);
		background: rgba(201, 162, 39, 0.08);
	}

	.drift-title {
		margin: 0 0 0.4rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold-bright, #f0c44a);
	}

	.drift ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.35rem;
		font-size: 0.86rem;
		color: var(--lavender, #b8aacf);
	}

	.drift ul li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.5rem;
		align-items: baseline;
	}

	.drift .tag {
		font-size: 0.66rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.drift li.blocker .tag {
		color: #ff8fab;
	}

	.drift li.note .tag {
		color: var(--gold-bright, #f0c44a);
	}

	.drift li.check-failed .tag {
		color: var(--lavender, #b8aacf);
	}

	.fixes-title {
		margin-top: 0.75rem;
	}

	/* The fixes are a plain list — they carry no severity, so they get no tag column. */
	.drift ul.fixes {
		padding-left: 1.1rem;
		list-style: disc;
	}

	.drift ul.fixes li {
		display: list-item;
	}

	.preview-grid {
		display: grid;
		gap: 1rem;
	}

	figure {
		margin: 0;
		border-radius: 0.8rem;
		overflow: hidden;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
	}

	figure img {
		display: block;
		width: 100%;
		height: auto;
	}

	figure.sparkle {
		position: relative;
	}

	figure.sparkle::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				ellipse at 20% 20%,
				rgba(240, 196, 74, 0.25),
				transparent 55%
			),
			radial-gradient(
				ellipse at 80% 80%,
				rgba(232, 0, 106, 0.18),
				transparent 50%
			);
		pointer-events: none;
	}

	.page-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.download-link {
		display: inline-flex;
		align-items: center;
		padding: 0.6rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		background: rgba(201, 162, 39, 0.08);
		color: var(--gold-bright, #f0c44a);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 600;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.download-link:hover {
		border-color: var(--gold, #c9a227);
		background: rgba(201, 162, 39, 0.15);
	}
</style>
