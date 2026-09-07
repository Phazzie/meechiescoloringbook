<!--
Purpose: Verdict card (what Meechie said, and what she said about saying it) and Quote Vault
         (saved coloring pages).
Why: Extracted from +page.svelte; parent owns creations state and vault callbacks. The vault
     shows every saved page — thumbnail, date, quote, pin, search — because the record already
     holds all of it and the old four-row title list showed none of it.
     The verdict card showed three of the seven fields the studio requires of the provider on every
     call. `qualityState` reached no screen at all, so `blocked` — Meechie stating she could not
     rule on this — was pixel-identical to a finished verdict; `revisionNote`, the field defined in
     the prompt as "What you'd need to do this better", was billed on every call and rendered
     nowhere, leaving three unlabelled rewrite buttons and a finite budget to guess with; and
     `rating` appeared as a bare "8/10", which beside a verdict reads as a grade for the verdict
     rather than Meechie's severity reading of the situation.
Info flow: Parent passes a `VerdictReport` built by `buildVerdictReport` + prepared vault entries;
           open/pin/delete/undo/search and "give her more evidence" propagate via callbacks.
Invariants: Nothing here reads `textOutput.qualityState`. A standing is shown only when the report
            carries one, because a required contract field always holds a value and the value alone
            cannot say whether anybody reported it. Two producers have to invent one —
            `buildStudioTextFromSpec` rebuilding a record that stored no text, and
            `buildToolStudioText`, whose `MeechieToolOutput` has no such field — so the card repeats
            a standing only when a studio response is known to have written it.
-->
<script lang="ts">
	import type { CreationRecord } from '$lib/seams/creation-store-seam/contract';
	import type { VaultEntry } from '$lib/core/vault-gallery';
	import { ADD_EVIDENCE_LABEL, type VerdictReport } from '$lib/core/verdict-report';
	import VaultGallery from '$lib/components/VaultGallery.svelte';
	import type { VaultCollection } from '$lib/components/vault-collection.svelte';

	let {
		report,
		onAddEvidence,
		vault,
		visibleVaultEntries,
		hiddenVaultCount,
		canToggleVaultShowAll,
		vaultShowAll,
		vaultCountLabel,
		onLoadCreation,
		onToggleShowAll
	}: {
		/** Everything the card says about the answer on screen. Built in core; rendered here. */
		report: VerdictReport;
		/** Takes the reader back to the evidence box. Offered only when Meechie asked for more. */
		onAddEvidence: () => void;
		/** The saved pages. Passed whole to `VaultGallery`, which owns every operation on them. */
		vault: VaultCollection;
		/** The preview slice this card shows — the studio's decision, not the vault's. */
		visibleVaultEntries: VaultEntry[];
		hiddenVaultCount: number;
		canToggleVaultShowAll: boolean;
		vaultShowAll: boolean;
		/** The count sentence, built in core so this card and `/vault` word it identically. */
		vaultCountLabel: string;
		onLoadCreation: (_creation: CreationRecord) => Promise<void>;
		onToggleShowAll: () => void;
	} = $props();
</script>

<section class="verdict-row">
	<article class="verdict-card" data-testid="home-verdict-card">
		<p class="eyebrow">Verdict</p>
		<h2 data-testid="home-verdict-headline">{report.verdict}</h2>
		<!-- The quote is hers, so it wears quotation marks. The idle line is the app's own and does
		     not, because a placeholder in quotes reads as something Meechie said. -->
		<p data-testid="home-verdict-quote" class:idle={!report.hasVerdict}>
			{report.hasVerdict ? `"${report.quote}"` : report.quote}
		</p>

		{#if report.severity}
			<!-- Was a bare "8/10". The number is Meechie's severity read on the situation, and the
			     label is the whole difference between that and a grade for her answer. -->
			<p
				class="severity"
				data-testid="home-verdict-severity"
				data-weight={report.severity.weight}
			>
				<span class="rating">{report.severity.label}</span>
				<span class="severity-meaning">{report.severity.meaning}</span>
			</p>
		{/if}

		{#if report.standing}
			<!-- `aria-live` is deliberate and narrow: this region changes when a verdict lands, and a
			     reader who cannot see the tone colour is otherwise told nothing about the difference
			     between a ruling and a refusal to rule. -->
			<div
				class="standing"
				data-testid="home-verdict-standing"
				data-tone={report.standing.tone}
				data-state={report.standing.code}
				aria-live="polite"
			>
				<p class="standing-line">{report.standing.sentence}</p>
				{#if report.standing.invitesMore}
					<button
						type="button"
						class="ghost"
						data-testid="home-verdict-add-evidence"
						onclick={onAddEvidence}>{ADD_EVIDENCE_LABEL}</button
					>
				{/if}
			</div>
		{/if}

		{#if report.note}
			<!-- The provider is required to return this on every call and it reached no screen until
			     now. Attributed, because it is Meechie's note on her own answer and not the app's
			     advice — and shown on a clean verdict too, since "what would make this sharper" is
			     worth the same either way. -->
			<div class="her-note" data-testid="home-verdict-note">
				<p class="eyebrow">What would sharpen it</p>
				<p>{report.note}</p>
			</div>
		{/if}
	</article>

	<VaultGallery
		{vault}
		entries={visibleVaultEntries}
		testIdPrefix="home"
		countLabel={vaultCountLabel}
		onOpen={onLoadCreation}
	>
		{#snippet footer()}
			{#if canToggleVaultShowAll}
				<button
					type="button"
					class="vault-more"
					data-testid="home-vault-show-all"
					onclick={onToggleShowAll}
				>
					{vaultShowAll ? 'Show fewer' : `Show ${hiddenVaultCount} more`}
				</button>
			{/if}
		{/snippet}
	</VaultGallery>
</section>

<style>
	/*
	 * Scoped to this component. The card's frame, `.eyebrow` and `.rating` are `:global` rules in
	 * `+page.svelte`; everything below is new to the card and belongs with the markup that uses it.
	 * No literal colours — the palette lives on `body` in `+layout.svelte`.
	 */
	.severity {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0.6rem 0 0;
	}

	.severity-meaning {
		font-size: 0.79rem;
		color: var(--lavender);
	}

	/* Weight is the only thing the number's size says on its own. It adds no words. */
	.severity[data-weight='low'] .rating {
		background: rgba(0, 200, 150, 0.16);
		color: var(--emerald);
	}

	.severity[data-weight='mid'] .rating {
		background: rgba(201, 162, 39, 0.18);
		color: var(--gold-bright);
	}

	.standing {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-top: 0.85rem;
		padding: 0.62rem 0.8rem;
		border-radius: 0.72rem;
		border: 1px solid var(--gold-border);
		background: rgba(7, 7, 15, 0.55);
	}

	.standing[data-tone='ok'] {
		border-color: rgba(0, 200, 150, 0.35);
	}

	.standing[data-tone='caution'] {
		border-color: rgba(201, 162, 39, 0.5);
	}

	.standing[data-tone='stop'] {
		border-color: rgba(232, 0, 106, 0.45);
		background: var(--fuchsia-glow);
	}

	.standing-line {
		margin: 0;
		font-weight: 700;
		color: var(--cream);
	}

	.standing[data-tone='ok'] .standing-line {
		font-weight: 600;
		color: var(--lavender);
	}

	.ghost {
		border-radius: 999px;
		padding: 0.42rem 0.9rem;
		border: 1px solid var(--gold-border);
		background: transparent;
		color: var(--gold-bright);
		font-family: inherit;
		font-weight: 600;
		font-size: 0.84rem;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			border-color 0.2s ease;
	}

	.ghost:hover {
		transform: translateY(-1px);
		border-color: var(--gold);
	}

	.her-note {
		margin-top: 0.85rem;
		padding-top: 0.7rem;
		border-top: 1px dashed var(--gold-border);
	}

	.her-note p:last-child {
		margin: 0;
		color: var(--cream);
	}

	.idle {
		color: var(--lavender);
		font-style: italic;
	}

	/* Rendered through `VaultGallery`'s `footer` snippet but compiled in this component's scope,
	   because the snippet is written here. It is this card's control, not the vault's: the gallery
	   shows the rows it is handed, and only a preview inside a studio has anything to expand. */
	.vault-more {
		width: 100%;
		margin-top: 0.6rem;
	}
</style>
