<!--
Purpose: Provide a direct route to Meechie tools while the main UI hosts the primary entry.
Why: Preserve deep links while keeping the tools accessible on the main page.
Info flow: Route -> MeechieTools component -> MeechieToolSeam.
-->
<script lang="ts">
	import MeechieTools from '$lib/components/MeechieTools.svelte';
</script>

<svelte:head>
	<title>Talk To Meechie</title>
</svelte:head>

<div class="meechie-page">
	<header class="hero">
		<p class="eyebrow">Meechie Voice Lab</p>
		<h1>If she said it, she meant it.</h1>
		<p>Sharp tools for apologies, clapbacks, receipts, and decisions.</p>
	</header>
	<MeechieTools />
</div>

<style>
	.meechie-page {
		max-width: 1180px;
		margin: 0 auto;
		padding: 2rem 1.2rem 3.5rem;
	}

	.hero {
		margin-bottom: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.45rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #7a4f1f;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		line-height: 1;
		color: #152035;
	}

	p {
		margin: 0;
		color: #4d5b71;
	}

	@media (max-width: 680px) {
		.meechie-page {
			padding: 1.2rem 0.85rem 2.6rem;
		}
	}
</style>
