<!--
Purpose: The page an installed copy of the app opens to when a navigation reaches neither the
     network nor the cache.
Why: The manifest declares `display: standalone`, so before this existed the installed app's answer
     to being offline was the browser's own network-error page — no navigation, no branding, and no
     statement of what was and was not still possible. This page exists so that the offline case
     has a surface that belongs to the app, and so that what it says is scoped to what is actually
     true: the pages already on this device open, and anything that costs a provider call does not.
Info flow: service worker (`handleFetch` navigation fallback) -> this prerendered HTML. Once it is
     on screen the client rehydrates, so the retry button and the live connection line below are
     real: they read `navigator.onLine` on this device rather than describing it in the abstract.
Invariants:
  - Prerendered (see `+page.ts`). It is cached at install and must exist as a file at build time.
  - Every claim here is about *this device*. It must not say a page can be made, because making one
    needs `/api/generate`, which the service worker deliberately never answers from a cache.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { modeCatalog } from '$lib/core/mode-catalog';

	const modes = modeCatalog();

	// `null` until `navigator.onLine` has been read, and the line below renders nothing for `null`.
	//
	// This started as `true`, and `true` was the worst possible default *here* of all places: this
	// document is the one the service worker serves during an actual outage, so its prerendered
	// HTML would have opened with "Your connection is back. Reload and carry on." — until hydration
	// ran, and forever if hydration could not start, which on a dead network is not a remote case.
	// The page whose entire job is to be honest about the network was shipping the one sentence
	// that is guaranteed false at the moment it appears.
	let isOnline = $state<boolean | null>(null);

	onMount(() => {
		const sync = () => {
			isOnline = navigator.onLine;
		};
		sync();
		globalThis.addEventListener('online', sync);
		globalThis.addEventListener('offline', sync);
		return () => {
			globalThis.removeEventListener('online', sync);
			globalThis.removeEventListener('offline', sync);
		};
	});
</script>

<svelte:head>
	<title>Offline — Meechie's Coloring Book</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<p class="eyebrow">Meechie checked</p>
	<h1>You are off the grid.</h1>
	<p class="message" data-testid="offline-message">
		That page needed the network and the network is not there. Nothing you saved is lost —
		it is on this device, and this device still works.
	</p>

	<p class="connection" data-testid="offline-connection" aria-live="polite">
		{#if isOnline === null}
			<!-- Nothing. Said before this device has been asked, it would be a guess either way. -->
		{:else if isOnline}
			Your connection is back. Reload and carry on.
		{:else}
			Still no connection.
		{/if}
	</p>

	<div class="actions">
		<button
			type="button"
			class="cta"
			data-testid="offline-retry"
			onclick={() => globalThis.location.reload()}
		>
			Try again
		</button>
		<a class="ghost" href="/">Open the coloring book</a>
	</div>

	<section class="what">
		<div>
			<p class="what-title">Still works right now</p>
			<ul>
				<li>Your Quote Vault — every page you saved, and its picture</li>
				<li>Downloading a saved page as a PDF or an image</li>
				<li>Reading and writing evidence, and every mode's questions</li>
			</ul>
		</div>
		<div>
			<p class="what-title">Waits for a connection</p>
			<ul>
				<li>A new verdict or quote from Meechie</li>
				<li>Making a coloring page</li>
				<li>The wig try-on</li>
			</ul>
		</div>
	</section>

	<section class="modes">
		<p class="modes-title">Modes on this device</p>
		<ul class="mode-links">
			{#each modes as mode (mode.slug)}
				<li><a href={`/m/${mode.slug}`}>{mode.title}</a></li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 4rem 1.4rem 6rem;
		min-height: 70vh;
		background:
			radial-gradient(circle at 0% 0%, rgba(232, 0, 106, 0.18), transparent 42%),
			radial-gradient(circle at 100% 50%, rgba(107, 33, 168, 0.16), transparent 45%);
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
		margin: 0 0 1rem;
		font-size: 1rem;
		line-height: 1.5;
		color: var(--lavender, #b8aacf);
	}

	.connection {
		margin: 0 0 1.8rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gold, #c9a227);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		align-items: center;
	}

	.cta {
		border: 0;
		cursor: pointer;
		border-radius: 999px;
		padding: 0.85rem 1.6rem;
		background: linear-gradient(112deg, #e8006a, #6b21a8 55%, #c9a227);
		color: #fff;
		font-family: inherit;
		font-weight: 800;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.ghost {
		display: inline-block;
		border-radius: 999px;
		padding: 0.8rem 1.5rem;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		color: var(--gold-bright, #f0c44a);
		text-decoration: none;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.what {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.6rem;
		margin-top: 2.6rem;
		padding-top: 1.4rem;
		border-top: 1px solid rgba(201, 162, 39, 0.25);
	}

	.what-title {
		margin: 0 0 0.6rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold, #c9a227);
	}

	.what ul {
		margin: 0;
		padding-left: 1.1rem;
		color: var(--lavender, #b8aacf);
		font-size: 0.92rem;
		line-height: 1.6;
	}

	.modes {
		margin-top: 2.2rem;
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

	.mode-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.mode-links a {
		display: inline-block;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		color: var(--gold-bright, #f0c44a);
		text-decoration: none;
		font-size: 0.86rem;
		font-weight: 600;
	}

	.mode-links a:hover {
		border-color: var(--gold, #c9a227);
		background: rgba(201, 162, 39, 0.1);
	}
</style>
