<!--
Purpose: Verdict card (AI output summary) and Quote Vault (saved coloring pages).
Why: Extracted from +page.svelte; parent owns creations state and vault callbacks. The vault
     shows every saved page — thumbnail, date, quote, pin, search — because the record already
     holds all of it and the old four-row title list showed none of it.
Info flow: Parent passes textOutput + prepared vault entries; open/pin/delete/undo/search actions
           propagate via callbacks.
-->
<script lang="ts">
	import type { MeechieStudioTextOutput } from '../../../../contracts/meechie-studio-text.contract';
	import type { CreationRecord } from '../../../../contracts/creation-store.contract';
	import type { VaultEntry } from '$lib/core/vault-gallery';

	let {
		textOutput,
		vaultEntries,
		visibleVaultEntries,
		hiddenVaultCount,
		canToggleVaultShowAll,
		totalSavedCount,
		vaultShowAll,
		vaultQuery,
		vaultError,
		pendingDeleteId,
		undoableDeletion,
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
		textOutput: MeechieStudioTextOutput | null;
		vaultEntries: VaultEntry[];
		visibleVaultEntries: VaultEntry[];
		hiddenVaultCount: number;
		canToggleVaultShowAll: boolean;
		totalSavedCount: number;
		vaultShowAll: boolean;
		vaultQuery: string;
		vaultError: string;
		pendingDeleteId: string | null;
		undoableDeletion: CreationRecord | null;
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
					<button type="button" class="link" onclick={onDismissUndo}>Dismiss</button>
				</div>
			</div>
		{/if}

		{#if vaultError}
			<p class="error" data-testid="home-vault-error">{vaultError}</p>
		{/if}

		{#if vaultError && totalSavedCount === 0}
			<!-- A failed read leaves `creations` empty, so without this the storage error would sit
			     directly above "No saved pages yet" — telling the reader their pages do not exist
			     when the truth is the app could not read them. -->
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
