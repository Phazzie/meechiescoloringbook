<!--
Purpose: The Quote Vault as it appears on a screen — the count, the search, the undo banner, every
         saved page as a row, and every sentence the vault says when it has nothing to show.
Why: This markup lived inside `VerdictRow.svelte`, and its forty-three style rules lived in
     `+page.svelte` as `:global(.studio .vault-*)`. That split is why the vault never left the home
     page: the markup was reachable by copying and the styling was not, so any surface that copied
     it rendered unstyled. This component owns both, including the button, input and card-frame
     rules it used to inherit from `.studio` — so it renders the same inside the studio and on a
     route that has no studio in it at all.
Info flow: A `VaultCollection` + the already-ordered entries to show -> rows; open/pin/delete/undo
           and the search go straight back to that collection, except opening, which the host
           decides (the studio reopens in place, the vault route links to the studio).
Invariants: Reads and writes exactly one collection. Nothing here holds a copy of the pages, so two
            surfaces rendering the same vault cannot disagree about what is in it. Opening is either
            a button or a link and never both.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CreationRecord } from '$lib/seams/creation-store-seam/contract';
	import type { VaultEntry } from '$lib/core/vault-gallery';
	import { VAULT_EMPTY, VAULT_UNREADABLE, vaultNoMatches } from '$lib/core/vault-page';
	import type { VaultCollection } from './vault-collection.svelte';

	let {
		vault,
		entries,
		testIdPrefix,
		eyebrow = 'Quote Vault',
		heading = 'Saved Pages',
		countLabel,
		openHref,
		onOpen,
		controls,
		footer
	}: {
		/** The pages themselves. Every mutation this component offers goes back through it. */
		vault: VaultCollection;
		/**
		 * The rows to render, already filtered and ordered by the host.
		 *
		 * Not `vault.entries` directly: the home card shows a preview of the first few and the
		 * vault route shows everything in a reader-chosen order. Which subset, in which order, is
		 * the surface's question; what a row *is* is this component's.
		 */
		entries: VaultEntry[];
		/**
		 * Namespaces every `data-testid` here, so two surfaces rendering this component are
		 * addressable apart. The same device `PageExportRow.svelte` uses, for the same reason.
		 */
		testIdPrefix: string;
		eyebrow?: string;
		heading?: string;
		/** The count sentence, built by `describeVaultCount` so both surfaces word it identically. */
		countLabel: string;
		/**
		 * Where a row goes when it is opened, for a surface that navigates. Given this, the row is
		 * a link; given `onOpen` instead, it is a button. Reopening a page on the studio mutates
		 * state and must not navigate; reopening one from `/vault` has to travel to the studio.
		 */
		openHref?: (_entry: VaultEntry) => string;
		/** Reopen in place. Mutually exclusive with `openHref`. */
		onOpen?: (_record: CreationRecord) => void;
		/** Extra controls beside the search box — the vault route's sort order. */
		controls?: Snippet;
		/** Anything under the list — the home card's "Show N more". */
		footer?: Snippet;
	} = $props();

	const testId = (suffix: string): string => `${testIdPrefix}-vault-${suffix}`;
	const searchId = $derived(`${testIdPrefix}-vault-search`);
</script>

<article class="vault-card">
	<div class="vault-head">
		<div>
			<p class="eyebrow">{eyebrow}</p>
			<h2>{heading}</h2>
		</div>
		{#if countLabel}
			<span class="vault-count" data-testid={testId('count')}>{countLabel}</span>
		{/if}
	</div>

	{#if vault.totalSavedCount > 0}
		<div class="vault-controls">
			<div class="vault-search-field">
				<label class="vault-search-label" for={searchId}>Search the vault</label>
				<input
					id={searchId}
					class="vault-search"
					type="search"
					data-testid={testId('search')}
					placeholder="Title, quote, or a line off the page"
					value={vault.query}
					oninput={(event) => vault.setQuery(event.currentTarget.value)}
				/>
			</div>
			{@render controls?.()}
		</div>
	{/if}

	{#if vault.undoableDeletion}
		<div class="vault-undo" data-testid={testId('undo')}>
			<span>"{vault.undoableDeletion.intent.title}" is gone.</span>
			<div class="vault-undo-actions">
				<button type="button" data-testid={testId('undo-restore')} onclick={vault.undoDelete}
					>Put it back</button
				>
				<!-- The held page is out of the list, so this is the only place it can be saved
				     from. When the vault is full "Put it back" refuses and says to download it
				     first; that instruction needs somewhere to point. -->
				{#if vault.undoableDeletionEntry?.imageSource}
					<a
						class="link"
						data-testid={testId('undo-download')}
						href={vault.undoableDeletionEntry.imageSource}
						download={vault.undoableDeletionEntry.downloadName}>Download it</a
					>
				{/if}
				<button type="button" class="link" onclick={vault.dismissUndoDelete}>Dismiss</button>
			</div>
		</div>
	{/if}

	{#if vault.error}
		<p class="error" data-testid={testId('error')}>{vault.error}</p>
	{/if}

	{#if vault.readFailed && vault.totalSavedCount === 0}
		<!-- A failed read leaves `creations` empty, so without this the storage error would sit
		     directly above "No saved pages yet" — telling the reader their pages do not exist when
		     the truth is the app could not read them. Keyed on the read specifically: a failed
		     *write* into an empty vault also sets `error` and can also leave the list empty, and
		     there the pages really are gone, so claiming otherwise would be the same lie in
		     reverse. -->
		<p class="empty" data-testid={testId('unreadable')}>{VAULT_UNREADABLE}</p>
	{:else if vault.totalSavedCount === 0}
		<p class="empty" data-testid={testId('empty')}>{VAULT_EMPTY}</p>
	{:else if vault.entries.length === 0}
		<p class="empty" data-testid={testId('no-matches')}>{vaultNoMatches(vault.query)}</p>
	{:else}
		<ul class="vault-list" data-testid={testId('list')}>
			{#each entries as entry (entry.id)}
				<li class="vault-item" class:pinned={entry.favorite}>
					{#snippet rowBody()}
						{#if entry.imageSource}
							<img
								class="vault-thumb"
								data-testid={testId('thumb')}
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
					{/snippet}

					{#if openHref}
						<a class="vault-open" data-testid={testId('load')} href={openHref(entry)}>
							{@render rowBody()}
						</a>
					{:else}
						<button
							type="button"
							class="vault-open"
							data-testid={testId('load')}
							onclick={() => onOpen?.(entry.record)}
						>
							{@render rowBody()}
						</button>
					{/if}

					<!-- While a delete is armed the row shows only the decision, so the confirm
					     button never sits next to an unrelated control. -->
					<div class="vault-item-actions">
						{#if vault.pendingDeleteId === entry.id}
							<button
								type="button"
								class="danger"
								data-testid={testId('delete-confirm')}
								onclick={() => vault.remove(entry.id)}>Delete for real</button
							>
							<button
								type="button"
								data-testid={testId('delete-cancel')}
								onclick={vault.cancelDelete}>Keep it</button
							>
						{:else}
							{#if entry.imageSource}
								<a
									class="button-link"
									data-testid={testId('download')}
									href={entry.imageSource}
									download={entry.downloadName}
									aria-label="Download {entry.title}">Download</a
								>
							{/if}
							<button
								type="button"
								data-testid={testId('pin')}
								aria-pressed={entry.favorite}
								aria-label={entry.favorite ? `Unpin ${entry.title}` : `Pin ${entry.title}`}
								onclick={() => vault.toggleFavorite(entry.record)}
							>
								{entry.favorite ? 'Unpin' : 'Pin'}
							</button>
							<button
								type="button"
								data-testid={testId('delete')}
								aria-label="Delete {entry.title}"
								onclick={() => vault.requestDelete(entry.id)}>Delete</button
							>
						{/if}
					</div>
				</li>
			{/each}
		</ul>

		{@render footer?.()}
	{/if}
</article>

<style>
	/*
	 * Everything this component needs, including the card frame, the label typography, the input
	 * and the button rules it used to inherit from `:global(.studio …)` in `+page.svelte`. That
	 * inheritance is precisely what kept the vault on the home page — the markup could be copied
	 * anywhere and the styling could not follow it. No literal colours beyond the two already used
	 * for danger and error text: the palette lives on `body` in `+layout.svelte`.
	 */
	.vault-card {
		border: 1px solid rgba(201, 162, 39, 0.24);
		border-radius: 8px;
		background: rgba(22, 20, 42, 0.92);
		padding: 1rem;
	}

	.vault-card :is(button, .button-link, .eyebrow, label) {
		font-family: var(--font-label);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		color: var(--gold);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 800;
	}

	.vault-card :is(button, .button-link) {
		min-height: 40px;
		padding: 0.58rem 0.82rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.58);
		color: var(--gold-bright);
		text-decoration: none;
		cursor: pointer;
		font-size: 0.78rem;
	}

	.vault-card input {
		width: 100%;
		margin: 0.35rem 0 0.9rem;
		padding: 0.72rem 0.78rem;
		border-radius: 6px;
		border: 1px solid rgba(201, 162, 39, 0.24);
		background: rgba(7, 7, 15, 0.78);
		color: var(--cream);
		font: inherit;
	}

	.vault-card input:focus {
		outline: 2px solid rgba(240, 196, 74, 0.48);
		outline-offset: 1px;
	}

	.vault-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.vault-count {
		flex-shrink: 0;
		padding: 0.24rem 0.5rem;
		border: 1px solid rgba(201, 162, 39, 0.28);
		border-radius: 999px;
		color: var(--gold-bright);
		font-family: var(--font-label);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	/* The search grows and anything beside it (the sort order) takes what it needs, so a narrow
	   card stacks them rather than squeezing the search box to nothing. */
	.vault-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0 0.7rem;
	}

	.vault-search-field {
		flex: 1 1 190px;
		min-width: 0;
	}

	/* Visible label rather than a placeholder-only field: the placeholder disappears the
	   moment anyone types, and a search box with no name is unreadable to a screen reader. */
	.vault-search-label {
		display: block;
		font-size: 0.68rem;
		color: var(--gold);
	}

	.vault-card input.vault-search {
		margin: 0.3rem 0 0.75rem;
	}

	.vault-undo {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(201, 162, 39, 0.1);
		color: var(--cream);
		font-size: 0.84rem;
	}

	.vault-undo-actions {
		display: flex;
		gap: 0.4rem;
	}

	.vault-list {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Wraps rather than overflows: the vault card is narrow on a phone and narrow again in the
	   desktop two-column row, so the actions drop onto their own line instead of colliding
	   with the title. */
	.vault-item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem 0.6rem;
		border-top: 1px solid rgba(201, 162, 39, 0.14);
		padding-top: 0.5rem;
	}

	.vault-item.pinned {
		border-top-color: rgba(240, 196, 74, 0.5);
	}

	/* The whole row is the open target, so the click area matches what a reader would aim at.
	   A button in the studio, where reopening mutates state; a link on the vault route, where it
	   genuinely navigates — styled identically so the row looks the same either way. */
	.vault-card .vault-open {
		flex: 1 1 190px;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		min-height: 0;
		padding: 0.35rem;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		text-align: left;
		text-decoration: none;
		text-transform: none;
		letter-spacing: 0;
		cursor: pointer;
	}

	.vault-card .vault-open:hover,
	.vault-card .vault-open:focus-visible {
		border-color: rgba(201, 162, 39, 0.32);
		background: rgba(201, 162, 39, 0.08);
	}

	.vault-thumb {
		flex-shrink: 0;
		width: 46px;
		height: 60px;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.28);
		background: rgba(253, 246, 227, 0.92);
		object-fit: cover;
	}

	.vault-thumb-empty {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(7, 7, 15, 0.62);
		color: var(--lavender);
		font-size: 0.9rem;
		font-weight: 800;
	}

	.vault-copy {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.vault-title {
		color: var(--cream);
		font-family: var(--font-display);
		font-size: 0.98rem;
		font-style: italic;
		font-weight: 800;
		line-height: 1.2;
	}

	.vault-pin-mark {
		margin-right: 0.28rem;
		color: var(--gold-bright);
	}

	/* One line each: the vault is a list you scan, not a place to read the page. */
	.vault-quote,
	.vault-meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--lavender);
	}

	.vault-quote {
		font-size: 0.8rem;
	}

	.vault-meta {
		font-size: 0.7rem;
		font-family: var(--font-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.vault-item-actions {
		display: flex;
		flex: 0 1 auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.3rem;
	}

	.vault-card :is(.vault-item-actions, .vault-undo) :is(button, .button-link) {
		min-height: 32px;
		padding: 0.32rem 0.55rem;
		font-size: 0.66rem;
	}

	.vault-item-actions button[aria-pressed='true'] {
		border-color: var(--gold-bright);
		background: rgba(201, 162, 39, 0.18);
	}

	.vault-card .danger {
		border-color: rgba(232, 0, 106, 0.5);
		background: rgba(232, 0, 106, 0.16);
		color: #ff8ab3;
	}

	.vault-card .link {
		border-color: transparent;
		background: transparent;
		color: var(--lavender);
	}

	.error {
		margin: 0.7rem 0 0;
		color: #ff8ab3;
	}

	.empty {
		color: var(--lavender);
		font-style: italic;
	}

	@media (max-width: 700px) {
		/* A phone-width vault row reads top to bottom: the page, then what you can do to it. */
		.vault-item {
			flex-direction: column;
			align-items: stretch;
		}

		/* The 190px basis is a minimum *width* in a row; in a column it would become a
		   190px-tall block of dead space above the buttons. */
		.vault-card .vault-open {
			flex: 0 0 auto;
		}

		.vault-item-actions {
			justify-content: flex-start;
		}
	}
</style>
