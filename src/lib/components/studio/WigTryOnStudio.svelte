<!--
Purpose: Wig-catalog carousel, selfie upload, AI portrait generation, and result display.
Why: Extracted from +page.svelte; all wig try-on state lives in the parent.
Info flow: User selects wig + uploads photo → callbacks fire → parent calls /api/wig-try-on.
-->
<script module lang="ts">
	/**
	 * Maps a data-URL media type to the file extension that matches its bytes, so a
	 * download link never hands the browser a filename that lies about its content.
	 * Shared: the coloring-page export link in StudioPreviewPanel needs the same rule,
	 * and one implementation is the only way both stay correct.
	 */
	export const imageFileExtension = (
		dataUrl: string
	): 'jpg' | 'png' | 'webp' | 'svg' => {
		const mimeType = /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase();
		if (mimeType === 'image/jpeg') return 'jpg';
		if (mimeType === 'image/webp') return 'webp';
		if (mimeType === 'image/svg+xml') return 'svg';
		return 'png';
	};
</script>

<script lang="ts">
	import WigCarousel from '$lib/components/WigCarousel.svelte';
	import SelfieUpload from '$lib/components/SelfieUpload.svelte';
	import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

	let {
		selectedWigId,
		selectedWig,
		tryOnPortraitUrl,
		tryOnError,
		isTryingOn,
		canTryOn,
		isGenerating,
		onWigSelect,
		onSelfieUpload,
		onWigTryOn,
		onGenerateTryOnPage
	}: {
		selectedWigId: string | null;
		selectedWig: Wig | null;
		tryOnPortraitUrl: string;
		tryOnError: string;
		isTryingOn: boolean;
		canTryOn: boolean;
		isGenerating: boolean;
		onWigSelect: (_wig: Wig) => Promise<void>;
		onSelfieUpload: (_base64: string, _mimeType: 'image/jpeg' | 'image/png' | 'image/webp') => void;
		onWigTryOn: () => Promise<void>;
		onGenerateTryOnPage: () => Promise<void>;
	} = $props();

	// Fixed to 'en-US' so this always matches WigCarousel's `$X.XX` format, rendered on the
	// same screen for the same wig — a browser-locale-derived format (`undefined` locale)
	// would show e.g. "89,99 $" here while the carousel above still shows "$89.99".
	const formatUsd = (value: number): string =>
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(value);
</script>

<section class="wig-studio" aria-label="Wig try-on studio">
	<div class="wig-studio-head">
		<p class="eyebrow">Style Your Look</p>
		<h2>Wig Try-On</h2>
		<p>Pick a wig. Upload your photo. See what you look like walking in.</p>
	</div>

	<WigCarousel
		{selectedWigId}
		onSelect={(wig) => void onWigSelect(wig)}
	/>

	{#if selectedWig}
		<div class="try-on-row">
			<div class="try-on-controls">
				<p class="eyebrow">Step 2 — Your Photo</p>
				<SelfieUpload onUpload={onSelfieUpload} />
				<button
					type="button"
					class="primary try-on-btn"
					data-testid="home-try-on"
					onclick={onWigTryOn}
					disabled={!canTryOn}
				>
					{isTryingOn ? 'AI is styling...' : `Try On — ${selectedWig.name}`}
				</button>
				{#if tryOnError}
					<p class="error" data-testid="home-try-on-error">{tryOnError}</p>
				{/if}
				<a
					href={selectedWig.affiliateUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="button-link affiliate-link"
				>
					Shop {selectedWig.name} — {formatUsd(selectedWig.priceUsd)} ↗
				</a>
			</div>

			{#if tryOnPortraitUrl}
				<div class="try-on-result">
					<p class="eyebrow">Your Try-On Portrait</p>
					<img
						src={tryOnPortraitUrl}
						alt={`AI illustration of you wearing ${selectedWig.name}`}
						class="try-on-portrait"
						data-testid="home-try-on-portrait"
					/>
					<div class="try-on-result-actions">
						<a
							class="button-link"
							href={tryOnPortraitUrl}
							download={`meechie-try-on-${selectedWig.id}.${imageFileExtension(tryOnPortraitUrl)}`}
						>
							Save Portrait
						</a>
						<button
							type="button"
							class="primary"
							onclick={onGenerateTryOnPage}
							disabled={!tryOnPortraitUrl || isGenerating}
						>
							{isGenerating ? 'Creating...' : 'Make It a Coloring Page'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>
