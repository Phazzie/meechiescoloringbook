<!--
Purpose: Display 7 canonical quotes as presets that load into the workbench.
Why: Users can immediately color an authentic Meechie quote.
Info flow: User clicks quote -> studio state updates currentText -> triggers gen.
-->
<script lang="ts">
	import type { CanonPagePreset } from '$lib/core/canon-pages';
	import { CANON_PAGES } from '$lib/core/canon-pages';

	export let onSelect: (preset: CanonPagePreset) => void;
</script>

<div class="canon-gallery">
	<h3 class="eyebrow">Canon Classics</h3>
	<p class="description">Authentic Meechie quotes. Ready to color.</p>
	<div class="preset-grid">
		{#each CANON_PAGES as preset}
			<button class="preset-card" type="button" on:click={() => onSelect(preset)}>
				<span class="preset-title">{preset.pageTitle}</span>
				<span class="preset-verdict">"{preset.verdict}"</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.canon-gallery {
		margin: 2rem 0;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(201, 162, 39, 0.2);
		border-radius: 8px;
	}

	.description {
		font-size: 0.875rem;
		color: var(--cream-dim, #ccc);
		margin-bottom: 1rem;
		margin-top: 0.25rem;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.preset-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 1rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		color: inherit;
	}

	.preset-card:hover {
		background: rgba(201, 162, 39, 0.1);
		border-color: rgba(201, 162, 39, 0.5);
		transform: translateY(-2px);
	}

	.preset-title {
		font-family: var(--font-label, sans-serif);
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--gold, #c9a227);
		margin-bottom: 0.5rem;
		letter-spacing: 0.05em;
	}

	.preset-verdict {
		font-size: 0.9rem;
		line-height: 1.3;
		font-style: italic;
	}
</style>
