<!--
  Purpose: Browse the wig catalog — search, filter, sort — and pick one to try on.
  Why: The catalog raw-imported wigs.json and cast it to Wig[], so WigCatalogSeam's validation
       never ran and its WIG_CATALOG_EMPTY / WIG_CATALOG_LOAD_FAILED errors could not reach a
       reader: a broken catalog rendered as an empty row with no message. It now loads through the
       seam, says what went wrong, and lets you shop on the metadata every wig already carries.
  Info flow: WigCatalogSeam.listWigs -> buildWigFacets/applyWigQuery -> cards -> onSelect callback.
-->
<script lang="ts">
	import type { Wig } from '$lib/seams/wig-catalog-seam/contract';
	import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam';
	import {
		DEFAULT_WIG_QUERY,
		WIG_SORT_OPTIONS,
		applyWigQuery,
		buildWigFacets,
		describeWigMatches,
		isWigQueryActive,
		toggleWigFacetValue,
		wigDetailLine,
		type WigQuery
	} from '$lib/core/wig-catalog-gallery';

	let {
		selectedWigId = null,
		onSelect
	}: {
		selectedWigId: string | null;
		onSelect: (_wig: Wig) => void;
	} = $props();

	const catalog = createWigCatalogSeam();

	let wigs = $state<Wig[]>([]);
	let loadError = $state('');
	let isLoading = $state(true);
	let query = $state<WigQuery>({ ...DEFAULT_WIG_QUERY });

	// The seam caches after its first parse, so this costs one validation for the page's lifetime.
	$effect(() => {
		void (async () => {
			const result = await catalog.listWigs();
			if (result.ok) {
				wigs = result.value;
				loadError = '';
			} else {
				wigs = [];
				loadError = result.error.message;
			}
			isLoading = false;
		})();
	});

	const facets = $derived(buildWigFacets(wigs, query));
	const visibleWigs = $derived(applyWigQuery(wigs, query));
	const queryIsActive = $derived(isWigQueryActive(query));

	const clearQuery = (): void => {
		query = { ...DEFAULT_WIG_QUERY };
	};
</script>

<div class="wig-browser">
	{#if isLoading}
		<p class="catalog-status" data-testid="wig-catalog-loading">Loading the wig wall...</p>
	{:else if loadError}
		<p class="catalog-error" role="alert" data-testid="wig-catalog-error">
			The wig wall could not be loaded: {loadError}
		</p>
	{:else}
		<div class="wig-controls">
			<div class="control-row">
				<label class="search-label" for="wig-search">
					<span class="eyebrow">Find a wig</span>
					<input
						id="wig-search"
						type="search"
						data-testid="wig-search"
						placeholder="Name, colour, texture, vibe..."
						value={query.search}
						oninput={(event) => (query = { ...query, search: event.currentTarget.value })}
					/>
				</label>

				<label class="sort-label" for="wig-sort">
					<span class="eyebrow">Sort</span>
					<select
						id="wig-sort"
						data-testid="wig-sort"
						value={query.sort}
						onchange={(event) =>
							(query = {
								...query,
								sort: event.currentTarget.value as WigQuery['sort']
							})}
					>
						{#each WIG_SORT_OPTIONS as option}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="facet-row" data-testid="wig-facet-length" role="group" aria-label="Filter by length">
				<span class="facet-name">Length</span>
				{#each facets.lengths as facet}
					<button
						type="button"
						class="facet-chip"
						class:active={facet.selected}
						aria-pressed={facet.selected}
						disabled={facet.count === 0}
						onclick={() =>
							(query = { ...query, lengths: toggleWigFacetValue(query.lengths, facet.value) })}
					>
						{facet.label} <span class="facet-count">{facet.count}</span>
					</button>
				{/each}
			</div>

			<div class="facet-row" data-testid="wig-facet-hair-type" role="group" aria-label="Filter by hair type">
				<span class="facet-name">Hair</span>
				{#each facets.hairTypes as facet}
					<button
						type="button"
						class="facet-chip"
						class:active={facet.selected}
						aria-pressed={facet.selected}
						disabled={facet.count === 0}
						onclick={() =>
							(query = { ...query, hairTypes: toggleWigFacetValue(query.hairTypes, facet.value) })}
					>
						{facet.label} <span class="facet-count">{facet.count}</span>
					</button>
				{/each}
			</div>

			<div class="facet-row" data-testid="wig-facet-color" role="group" aria-label="Filter by colour">
				<span class="facet-name">Colour</span>
				{#each facets.colorFamilies as facet}
					<button
						type="button"
						class="facet-chip"
						class:active={facet.selected}
						aria-pressed={facet.selected}
						disabled={facet.count === 0}
						onclick={() =>
							(query = {
								...query,
								colorFamilies: toggleWigFacetValue(query.colorFamilies, facet.value)
							})}
					>
						{facet.label} <span class="facet-count">{facet.count}</span>
					</button>
				{/each}
			</div>

			<div class="result-row">
				<p class="result-count" data-testid="wig-result-count" aria-live="polite">
					{describeWigMatches(visibleWigs.length, wigs.length)}
				</p>
				{#if queryIsActive}
					<button type="button" class="clear-btn" data-testid="wig-clear" onclick={clearQuery}>
						Clear
					</button>
				{/if}
			</div>
		</div>

		{#if visibleWigs.length === 0}
			<p class="catalog-status" data-testid="wig-no-matches">
				Nothing in the catalog matches that. Loosen a filter and Meechie will keep looking.
			</p>
		{:else}
			<div class="wig-carousel" role="list" aria-label="Wig catalog — pick one to try on">
				{#each visibleWigs as wig (wig.id)}
					<article class="wig-card" class:selected={selectedWigId === wig.id} role="listitem">
						<button
							type="button"
							class="wig-card-btn"
							onclick={() => onSelect(wig)}
							aria-pressed={selectedWigId === wig.id}
							aria-label={`Select ${wig.name}`}
						>
							<img src={wig.imageUrl} alt={wig.name} class="wig-img" loading="lazy" />
							<div class="wig-info">
								{#if wig.brand}
									<span class="wig-brand">{wig.brand}</span>
								{/if}
								<p class="wig-name">{wig.name}</p>
								<p class="wig-meta">{wig.style}</p>
								<p class="wig-detail">{wigDetailLine(wig)}</p>
								<p class="wig-price">${wig.priceUsd.toFixed(2)}</p>
							</div>
							{#if selectedWigId === wig.id}
								<span class="selected-badge" aria-hidden="true">✓ Selected</span>
							{/if}
						</button>
						<a
							href={wig.affiliateUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="shop-link"
							onclick={(e) => e.stopPropagation()}
						>
							Shop ↗
						</a>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.wig-browser {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.wig-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.search-label {
		flex: 1 1 200px;
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}

	.sort-label {
		flex: 0 1 190px;
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}

	.eyebrow {
		font-family: var(--font-label, sans-serif);
		font-size: 0.6rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: rgba(253, 246, 227, 0.5);
	}

	.search-label input,
	.sort-label select {
		width: 100%;
		padding: 0.48rem 0.6rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.58);
		color: var(--cream, #fdf6e3);
		font-size: 0.82rem;
	}

	.search-label input:focus-visible,
	.sort-label select:focus-visible {
		outline: 2px solid var(--gold, #c9a227);
		outline-offset: 1px;
	}

	.facet-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.32rem;
	}

	.facet-name {
		font-family: var(--font-label, sans-serif);
		font-size: 0.6rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgba(253, 246, 227, 0.42);
		min-width: 3.4rem;
	}

	.facet-chip {
		padding: 0.28rem 0.52rem;
		border: 1px solid rgba(201, 162, 39, 0.3);
		border-radius: 999px;
		background: rgba(7, 7, 15, 0.5);
		color: rgba(253, 246, 227, 0.82);
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
		min-height: auto;
	}

	.facet-chip:hover:not(:disabled),
	.facet-chip:focus-visible {
		border-color: rgba(255, 20, 147, 0.6);
	}

	.facet-chip.active {
		border-color: #ff1493;
		background: rgba(255, 20, 147, 0.16);
		color: #ffd7e9;
	}

	.facet-chip:disabled {
		opacity: 0.34;
		cursor: not-allowed;
	}

	.facet-count {
		font-size: 0.64rem;
		opacity: 0.68;
	}

	.result-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.result-count {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(253, 246, 227, 0.55);
	}

	.clear-btn {
		padding: 0.24rem 0.5rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 999px;
		background: none;
		color: var(--gold-bright, #f0c44a);
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		cursor: pointer;
		min-height: auto;
	}

	.clear-btn:hover,
	.clear-btn:focus-visible {
		background: rgba(201, 162, 39, 0.12);
	}

	.catalog-status {
		margin: 0;
		padding: 0.7rem 0;
		font-size: 0.84rem;
		color: rgba(253, 246, 227, 0.62);
	}

	.catalog-error {
		margin: 0;
		padding: 0.7rem 0.8rem;
		border: 1px solid rgba(232, 0, 106, 0.3);
		border-radius: 0.6rem;
		background: rgba(232, 0, 106, 0.08);
		font-size: 0.84rem;
		color: #ff8ab3;
	}

	.wig-carousel {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		padding: 0.5rem 0 0.75rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(201, 162, 39, 0.4) transparent;
		-webkit-overflow-scrolling: touch;
	}

	.wig-card {
		flex: 0 0 156px;
		border: 2px solid rgba(201, 162, 39, 0.22);
		border-radius: 10px;
		background: rgba(22, 20, 42, 0.92);
		overflow: hidden;
		transition:
			border-color 0.18s,
			box-shadow 0.18s,
			transform 0.18s;
		position: relative;
	}

	.wig-card:hover {
		border-color: rgba(255, 20, 147, 0.65);
		transform: translateY(-3px);
		box-shadow: 0 6px 20px rgba(255, 20, 147, 0.2);
	}

	.wig-card.selected {
		border-color: #ff1493;
		box-shadow: 0 0 18px rgba(255, 20, 147, 0.45);
	}

	.wig-card-btn {
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		color: inherit;
		text-align: left;
		min-height: auto;
		display: block;
	}

	.wig-img {
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		display: block;
	}

	.wig-info {
		padding: 0.6rem 0.6rem 0.4rem;
	}

	.wig-brand {
		display: inline-block;
		font-size: 0.58rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(255, 20, 147, 0.85);
		background: rgba(255, 20, 147, 0.08);
		border: 1px solid rgba(255, 20, 147, 0.22);
		border-radius: 3px;
		padding: 0.1rem 0.35rem;
		margin-bottom: 0.3rem;
	}

	.wig-name {
		margin: 0 0 0.18rem;
		font-family: var(--font-label, sans-serif);
		font-size: 0.76rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--cream, #fdf6e3);
		line-height: 1.2;
	}

	.wig-meta {
		margin: 0 0 0.22rem;
		font-size: 0.68rem;
		color: rgba(253, 246, 227, 0.55);
		line-height: 1.3;
	}

	.wig-detail {
		margin: 0 0 0.22rem;
		font-size: 0.64rem;
		color: rgba(253, 246, 227, 0.42);
		line-height: 1.3;
	}

	.wig-price {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 700;
		color: #ffd700;
	}

	.selected-badge {
		display: block;
		margin: 0.3rem 0.6rem 0;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		background: rgba(255, 20, 147, 0.18);
		color: #ff1493;
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.shop-link {
		display: block;
		padding: 0.4rem 0.6rem;
		text-align: center;
		font-family: var(--font-label, sans-serif);
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #ff1493;
		text-decoration: none;
		border-top: 1px solid rgba(201, 162, 39, 0.16);
		background: rgba(255, 20, 147, 0.04);
		transition: background 0.12s;
	}

	.shop-link:hover,
	.shop-link:focus-visible {
		background: rgba(255, 20, 147, 0.14);
	}
</style>
