<!--
Purpose: Verdict card (AI output summary) and Quote Vault (saved creations list).
Why: Extracted from +page.svelte; parent owns creations state and vault callbacks.
Info flow: Parent passes textOutput + creations; user load/pin/delete actions propagate via callbacks.
-->
<script lang="ts">
	import type { MeechieStudioTextOutput } from '../../../../contracts/meechie-studio-text.contract';
	import type { CreationRecord } from '../../../../contracts/creation-store.contract';

	let {
		textOutput,
		creations,
		onLoadCreation,
		onDeleteCreation,
		onToggleFavorite
	}: {
		textOutput: MeechieStudioTextOutput | null;
		creations: CreationRecord[];
		onLoadCreation: (_creation: CreationRecord) => Promise<void>;
		onDeleteCreation: (_id: string) => Promise<void>;
		onToggleFavorite: (_creation: CreationRecord) => Promise<void>;
	} = $props();
</script>

<section class="verdict-row">
	<article class="verdict-card">
		<p class="eyebrow">Verdict</p>
		<h2>{textOutput?.verdict ?? 'No verdict yet.'}</h2>
		<p data-testid="home-verdict-quote">
			{textOutput?.quote ??
				'Meechie will put the quote here after the AI text action runs.'}
		</p>
		{#if textOutput?.rating}
			<span class="rating">{textOutput.rating}/10</span>
		{/if}
	</article>
	<article class="vault-card">
		<p class="eyebrow">Quote Vault</p>
		<h2>Saved Pages</h2>
		{#if creations.length === 0}
			<p data-testid="home-vault-empty">No saved pages yet.</p>
		{:else}
			<div class="vault-list">
				{#each creations.slice(0, 4) as creation}
					<div class="vault-item">
						<button
							type="button"
							data-testid="home-vault-load"
							onclick={() => onLoadCreation(creation)}
							>{creation.intent.title}</button
						>
						<div>
							<button
								type="button"
								data-testid="home-vault-pin"
								onclick={() => onToggleFavorite(creation)}
							>
								{creation.favorite ? 'Unpin' : 'Pin'}
							</button>
							<button
								type="button"
								data-testid="home-vault-delete"
								onclick={() => onDeleteCreation(creation.id)}>Delete</button
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</article>
</section>
