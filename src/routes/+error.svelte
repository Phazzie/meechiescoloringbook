<!--
Purpose: The app's error page — what a reader sees on a 404 or a failed load.
Why: The app had no error page at all, so every failure fell through to SvelteKit's unstyled
     default: black text on white, in an app that is otherwise entirely dark and styled. That
     became worth fixing when `/m/[mode]` started returning a real 404 for an unknown mode instead
     of silently rendering Random Meechie — a reader who mistypes a mode should land somewhere that
     still looks like the app and offers a way back in.
Info flow: SvelteKit page store -> status + message -> this page, plus links to every real mode.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { modeCatalog } from '$lib/core/mode-catalog';

	const modes = modeCatalog();
</script>

<svelte:head>
	<title>{page.status} — Meechie's Coloring Book</title>
</svelte:head>

<div class="page">
	<p class="eyebrow">Meechie checked</p>
	<h1>{page.status === 404 ? 'That page is not here.' : 'Something broke.'}</h1>
	<p class="message" data-testid="error-message">
		{page.error?.message ?? 'Try again in a moment.'}
	</p>

	<a class="cta" href="/">Back to the coloring book</a>

	<section class="modes">
		<p class="modes-title">Every mode that does exist</p>
		<ul>
			{#each modes as mode (mode.slug)}
				<li><a href={`/m/${mode.slug}`}>{mode.title}</a></li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.page {
		max-width: 620px;
		margin: 0 auto;
		padding: 4rem 1.4rem 6rem;
		min-height: 70vh;
		background:
			radial-gradient(circle at 0% 0%, rgba(232, 0, 106, 0.18), transparent 42%),
			radial-gradient(
				circle at 100% 50%,
				rgba(107, 33, 168, 0.16),
				transparent 45%
			);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--fuchsia, #e8006a);
	}

	h1 {
		margin: 0 0 0.8rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: clamp(2.2rem, 6vw, 3.2rem);
		font-style: italic;
		font-weight: 800;
		line-height: 1;
		color: var(--cream, #fdf6e3);
	}

	.message {
		margin: 0 0 1.8rem;
		font-size: 1rem;
		line-height: 1.5;
		color: var(--lavender, #b8aacf);
	}

	.cta {
		display: inline-block;
		border-radius: 999px;
		padding: 0.85rem 1.6rem;
		background: linear-gradient(112deg, #e8006a, #6b21a8 55%, #c9a227);
		color: #fff;
		font-weight: 800;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.modes {
		margin-top: 2.6rem;
		padding-top: 1.4rem;
		border-top: 1px solid rgba(201, 162, 39, 0.25);
	}

	.modes-title {
		margin: 0 0 0.8rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold, #c9a227);
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li a {
		display: inline-block;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		color: var(--gold-bright, #f0c44a);
		text-decoration: none;
		font-size: 0.86rem;
		font-weight: 600;
	}

	li a:hover {
		border-color: var(--gold, #c9a227);
		background: rgba(201, 162, 39, 0.1);
	}
</style>
