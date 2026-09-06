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
            cannot say whether anybody reported it — a page rebuilt from a stored record has a
            `'ready'` that `buildStudioTextFromSpec` had to invent to satisfy the schema.
-->
<script lang="ts">
	import type { CreationRecord } from '$lib/seams/creation-store-seam/contract';
	import type { VaultEntry } from '$lib/core/vault-gallery';
	import { ADD_EVIDENCE_LABEL, type VerdictReport } from '$lib/core/verdict-report';

	let {
		report,
		onAddEvidence,
		vaultEntries,
		visibleVaultEntries,
		hiddenVaultCount,
		canToggleVaultShowAll,
		totalSavedCount,
		vaultShowAll,
		vaultQuery,
		vaultError,
		vaultReadFailed,
		pendingDeleteId,
		undoableDeletion,
		undoableDeletionEntry,
		onLoadCreation,
		onRequestDelete,
		onCancelDelete,
		onConfirmDelete,
		onUndoDelete,
		onDismissUndo,
		onToggleFavorite,
		onVaultQueryChange,
		onToggleShowAll
	}: {
		/** Everything the card says about the answer on screen. Built in core; rendered here. */
		report: VerdictReport;
		/** Takes the reader back to the evidence box. Offered only when Meechie asked for more. */
		onAddEvidence: () => void;
		vaultEntries: VaultEntry[];
		visibleVaultEntries: VaultEntry[];
		hiddenVaultCount: number;
		canToggleVaultShowAll: boolean;
		totalSavedCount: number;
		vaultShowAll: boolean;
		vaultQuery: string;
		vaultError: string;
		vaultReadFailed: boolean;
		pendingDeleteId: string | null;
		undoableDeletion: CreationRecord | null;
		undoableDeletionEntry: VaultEntry | null;
		onLoadCreation: (_creation: CreationRecord) => Promise<void>;
		onRequestDelete: (_id: string) => void;
		onCancelDelete: () => void;
		onConfirmDelete: (_id: string) => Promise<void>;
		onUndoDelete: () => Promise<void>;
		onDismissUndo: () => void;
		onToggleFavorite: (_creation: CreationRecord) => Promise<void>;
		onVaultQueryChange: (_value: string) => void;
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

	<article class="vault-card">
		<div class="vault-head">
			<div>
				<p class="eyebrow">Quote Vault</p>
				<h2>Saved Pages</h2>
			</div>
			{#if totalSavedCount > 0}
				<span class="vault-count" data-testid="home-vault-count"
					>{totalSavedCount} saved</span
				>
			{/if}
		</div>

		{#if totalSavedCount > 0}
			<label class="vault-search-label" for="vault-search">Search the vault</label>
			<input
				id="vault-search"
				class="vault-search"
				type="search"
				data-testid="home-vault-search"
				placeholder="Title, quote, or a line off the page"
				value={vaultQuery}
				oninput={(event) => onVaultQueryChange(event.currentTarget.value)}
			/>
		{/if}

		{#if undoableDeletion}
			<div class="vault-undo" data-testid="home-vault-undo">
				<span>"{undoableDeletion.intent.title}" is gone.</span>
				<div class="vault-undo-actions">
					<button
						type="button"
						data-testid="home-vault-undo-restore"
						onclick={onUndoDelete}>Put it back</button
					>
					<!-- The held page is out of the list, so this is the only place it can be saved
					     from. When the vault is full "Put it back" refuses and says to download it
					     first; that instruction needs somewhere to point. -->
					{#if undoableDeletionEntry?.imageSource}
						<a
							class="link"
							data-testid="home-vault-undo-download"
							href={undoableDeletionEntry.imageSource}
							download={undoableDeletionEntry.downloadName}>Download it</a
						>
					{/if}
					<button type="button" class="link" onclick={onDismissUndo}>Dismiss</button>
				</div>
			</div>
		{/if}

		{#if vaultError}
			<p class="error" data-testid="home-vault-error">{vaultError}</p>
		{/if}

		{#if vaultReadFailed && totalSavedCount === 0}
			<!-- A failed read leaves `creations` empty, so without this the storage error would sit
			     directly above "No saved pages yet" — telling the reader their pages do not exist
			     when the truth is the app could not read them. Keyed on the read specifically: a
			     failed *write* into an empty vault also sets `vaultError`, and there the pages
			     really are gone, so claiming otherwise would be the same lie in reverse. -->
			<p class="empty" data-testid="home-vault-unreadable">
				Your saved pages could not be read. They are not gone — see above.
			</p>
		{:else if totalSavedCount === 0}
			<p class="empty" data-testid="home-vault-empty">
				No saved pages yet. Make one and hit Save to Vault.
			</p>
		{:else if vaultEntries.length === 0}
			<p class="empty" data-testid="home-vault-no-matches">
				Nothing in the vault matches "{vaultQuery.trim()}".
			</p>
		{:else}
			<ul class="vault-list" data-testid="home-vault-list">
				{#each visibleVaultEntries as entry (entry.id)}
					<li class="vault-item" class:pinned={entry.favorite}>
						<button
							type="button"
							class="vault-open"
							data-testid="home-vault-load"
							onclick={() => onLoadCreation(entry.record)}
						>
							{#if entry.imageSource}
								<img
									class="vault-thumb"
									data-testid="home-vault-thumb"
									src={entry.imageSource}
									alt="Saved coloring page: {entry.title}"
									loading="lazy"
								/>
							{:else}
								<span class="vault-thumb vault-thumb-empty" aria-hidden="true">
									{entry.itemCount || '—'}
								</span>
							{/if}
							<span class="vault-copy">
								<span class="vault-title">
									{#if entry.favorite}<span class="vault-pin-mark" aria-hidden="true"
											>★</span
										>{/if}{entry.title}
								</span>
								{#if entry.quote}
									<span class="vault-quote">"{entry.quote}"</span>
								{/if}
								<span class="vault-meta">{entry.savedLabel}</span>
							</span>
						</button>

						<!-- While a delete is armed the row shows only the decision, so the
						     confirm button never sits next to an unrelated control. -->
						<div class="vault-item-actions">
							{#if pendingDeleteId === entry.id}
								<button
									type="button"
									class="danger"
									data-testid="home-vault-delete-confirm"
									onclick={() => onConfirmDelete(entry.id)}>Delete for real</button
								>
								<button
									type="button"
									data-testid="home-vault-delete-cancel"
									onclick={onCancelDelete}>Keep it</button
								>
							{:else}
								{#if entry.imageSource}
									<a
										class="button-link"
										data-testid="home-vault-download"
										href={entry.imageSource}
										download={entry.downloadName}
										aria-label="Download {entry.title}">Download</a
									>
								{/if}
								<button
									type="button"
									data-testid="home-vault-pin"
									aria-pressed={entry.favorite}
									aria-label={entry.favorite
										? `Unpin ${entry.title}`
										: `Pin ${entry.title}`}
									onclick={() => onToggleFavorite(entry.record)}
								>
									{entry.favorite ? 'Unpin' : 'Pin'}
								</button>
								<button
									type="button"
									data-testid="home-vault-delete"
									aria-label="Delete {entry.title}"
									onclick={() => onRequestDelete(entry.id)}>Delete</button
								>
							{/if}
						</div>
					</li>
				{/each}
			</ul>

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
		{/if}
	</article>
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
</style>
