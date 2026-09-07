<!--
Purpose: The Quote Vault as a place — every page you have ever saved, at an address you can link to,
     search, sort and reach from anywhere in the app.
Why: The vault had no address. Thirteen surfaces could put a page into it and exactly one could show
     you what was in it: the home studio, in a card three screens down, showing four of a possible
     fifty. The other twelve told the reader to "find it on the home page" — a navigation
     instruction in place of a link. This route is the front door that sentence never had.
Info flow: `VaultCollection.init()` reads the session and this device's stored pages after
     hydration -> `sortVaultEntries` puts them in the reader's chosen order -> `VaultGallery`
     renders them. Reopening links to the studio, which is the only surface that can rebuild a page.
Invariants:
  - Prerendered (see `+page.ts`), so nothing about a reader's pages may reach this HTML file. The
    saved pages live in this device's storage and are read after hydration.
  - Nothing on screen before hydration may claim the vault is empty. This document is built once
    and replayed from the offline cache for days; "No saved pages yet" baked into it would be a
    statement about the build machine's storage, which has never held anybody's page.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import VaultGallery from '$lib/components/VaultGallery.svelte';
	import { VaultCollection } from '$lib/components/vault-collection.svelte';
	import {
		DEFAULT_VAULT_SORT,
		VAULT_SORT_OPTIONS,
		asVaultSortOrder,
		describeVaultCount,
		sortVaultEntries,
		vaultReopenHref,
		type VaultSortOrder
	} from '$lib/core/vault-page';

	const vault = new VaultCollection();

	/**
	 * False until this page is running in a browser with the pages actually read.
	 *
	 * The gate exists for the reason the invariant above gives, and it is the same gate
	 * `StudioHero` puts on the mode spotlight: a prerendered document cannot know anything about
	 * this device, so until hydration the page says it is reading rather than saying what it found.
	 */
	let isReady = $state(false);
	let sortOrder = $state<VaultSortOrder>(DEFAULT_VAULT_SORT);

	/** The rows, in the reader's order. `/vault` shows every match — the preview cap is the card's. */
	const entries = $derived(sortVaultEntries(vault.entries, sortOrder));
	const countLabel = $derived(
		describeVaultCount(vault.totalSavedCount, vault.entries.length, vault.query)
	);

	onMount(async () => {
		await vault.init();
		isReady = true;
	});

	onDestroy(() => {
		vault.destroy();
	});
</script>

<svelte:head>
	<title>Your Quote Vault — Meechie's Coloring Book</title>
</svelte:head>

<main class="vault-page" data-testid="vault-root" data-hydrated={isReady ? 'true' : 'false'}>
	<header class="vault-hero">
		<p class="eyebrow">Quote Vault</p>
		<h1>Everything you kept</h1>
		<p class="lede">
			Every page you saved, on this device. Open one to put it back in the studio, or take it
			away as a file — the picture is already here, so none of it costs another generation.
		</p>
	</header>

	{#if isReady}
		<VaultGallery
			{vault}
			{entries}
			testIdPrefix="vault"
			eyebrow="Saved on this device"
			heading="Your pages"
			{countLabel}
			openHref={(entry) => vaultReopenHref(entry.id)}
		>
			{#snippet controls()}
				{#if vault.totalSavedCount > 1}
					<div class="vault-sort">
						<label class="vault-sort-label" for="vault-sort">Order</label>
						<select
							id="vault-sort"
							data-testid="vault-sort"
							value={sortOrder}
							onchange={(event) => (sortOrder = asVaultSortOrder(event.currentTarget.value))}
						>
							{#each VAULT_SORT_OPTIONS as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			{/snippet}
		</VaultGallery>
	{:else}
		<!-- Says what it is doing, not what it found. See the invariant above. -->
		<p class="vault-loading" data-testid="vault-loading">Reading your saved pages…</p>
	{/if}

	<p class="vault-footnote">
		Saved pages live in this browser on this device — they are never uploaded. Clearing your
		browser's site data clears them too, so download anything you would hate to lose.
	</p>
</main>

<style>
	.vault-page {
		max-width: 820px;
		margin: 0 auto;
		padding: 1.4rem;
		color: var(--cream);
	}

	.vault-hero {
		margin-bottom: 1.2rem;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-family: var(--font-label);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 800;
		font-size: clamp(1.9rem, 5vw, 2.7rem);
	}

	.lede {
		margin: 0.6rem 0 0;
		max-width: 56ch;
		color: var(--lavender);
	}

	.vault-sort {
		display: flex;
		flex-direction: column;
		margin-bottom: 0.75rem;
	}

	.vault-sort-label {
		font-family: var(--font-label);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.vault-sort select {
		margin: 0.3rem 0 0;
		padding: 0.72rem 0.78rem;
		border-radius: 6px;
		border: 1px solid rgba(201, 162, 39, 0.24);
		background: rgba(7, 7, 15, 0.78);
		color: var(--cream);
		font: inherit;
	}

	.vault-sort select:focus {
		outline: 2px solid rgba(240, 196, 74, 0.48);
		outline-offset: 1px;
	}

	.vault-loading {
		margin: 0;
		padding: 1rem;
		border: 1px solid rgba(201, 162, 39, 0.24);
		border-radius: 8px;
		background: rgba(22, 20, 42, 0.92);
		color: var(--lavender);
		font-style: italic;
	}

	.vault-footnote {
		margin: 1rem 0 0;
		font-size: 0.82rem;
		color: var(--lavender);
	}
</style>
