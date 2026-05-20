<!--
  Purpose: Display a horizontally scrollable wig catalog for selection.
  Why: Give users a visual wig picker before the AI try-on step.
  Info flow: wigs.json import -> wig cards -> onSelect callback -> parent page state.
-->
<script lang="ts">
	import type { Wig } from '$lib/seams/wig-catalog-seam/contract';
	import wigData from '$lib/data/wigs.json';

	// Cast the imported JSON to Wig[] — validators run at adapter layer, not here.
	const wigs = wigData as unknown as Wig[];

	const getBrand = (affiliateUrl: string): string => {
		if (affiliateUrl.includes('beautyforever')) return 'Beautyforever';
		if (affiliateUrl.includes('wigsbuy')) return 'Wigsbuy';
		if (affiliateUrl.includes('luvmehair')) return 'Luvmehair';
		return '';
	};

	let {
		selectedWigId = null,
		onSelect
	}: {
		selectedWigId: string | null;
		onSelect: (_wig: Wig) => void;
	} = $props();
</script>

<div class="wig-carousel" role="list" aria-label="Wig catalog — pick one to try on">
	{#each wigs as wig}
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
					{#if getBrand(wig.affiliateUrl)}
						<span class="wig-brand">{getBrand(wig.affiliateUrl)}</span>
					{/if}
					<p class="wig-name">{wig.name}</p>
					<p class="wig-meta">{wig.style}</p>
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

<style>
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
