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
		<p class="eyebrow">
			<span aria-hidden="true">♛</span>
			Meechie's Full Toolkit
		</p>
		<h1>Power as fact.<br />Consequences on record.</h1>
		<p class="sub">Apology autopsies. Clapbacks. Receipt checks. Verdicts with no soft landing.</p>
		<div class="hero-rule" aria-hidden="true"></div>
	</header>
	<MeechieTools />
</div>

<style>
	.meechie-page {
		max-width: 920px;
		margin: 0 auto;
		padding: 3rem 1.4rem 4rem;
	}

	.hero {
		margin-bottom: 2.5rem;
	}

	.eyebrow {
		margin: 0 0 1rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		text-transform: uppercase;
		letter-spacing: 0.22em;
		font-size: 0.75rem;
		font-weight: 700;
		color: #c9a227;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	h1 {
		margin: 0 0 0.85rem;
		font-family: var(--font-display, 'Fraunces', 'Times New Roman', serif);
		font-size: clamp(2.2rem, 5vw, 3.6rem);
		font-style: italic;
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.03em;
		color: #fdf6e3;
	}

	.sub {
		margin: 0 0 1.5rem;
		font-size: 1rem;
		line-height: 1.55;
		color: #b8aacf;
		max-width: 480px;
	}

	.hero-rule {
		width: 48px;
		height: 3px;
		background: linear-gradient(90deg, #e8006a, #c9a227);
		border-radius: 2px;
	}

	@media (max-width: 680px) {
		.meechie-page {
			padding: 2rem 1rem 3rem;
		}
	}
</style>
