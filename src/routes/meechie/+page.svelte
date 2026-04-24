<!--
Purpose: Provide a direct route to Meechie tools while the main UI hosts the primary entry.
Why: Preserve deep links while keeping the tools accessible on the main page.
Info flow: Route -> MeechieTools component -> MeechieToolSeam.
-->
<script lang="ts">
	import MeechieTools from '$lib/components/MeechieTools.svelte';
</script>

<svelte:head>
	<title>Meechie's Tools — Meechie's Coloring Book</title>
</svelte:head>

<div class="meechie-page">
	<header class="hero">
		<p class="eyebrow">Meechie's Full Toolkit</p>
		<h1>She already knows what it means.</h1>
		<p class="sub">Apology autopsies. Clapbacks. Receipt checks. Verdicts with no soft landing.</p>
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
		margin-bottom: 1.2rem;
		padding: 1.2rem 0.2rem;
	}

	.eyebrow {
		margin: 0 0 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #c9a227;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(2rem, 4.5vw, 3.2rem);
		font-style: italic;
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.03em;
		color: #fdf6e3;
	}

	.sub {
		margin: 0;
		font-size: 1rem;
		color: #b8aacf;
	}

	@media (max-width: 680px) {
		.meechie-page {
			padding: 1.2rem 0.85rem 2.6rem;
		}
	}
</style>
