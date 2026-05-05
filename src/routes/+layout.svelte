<!--
Purpose: Shared layout wrapper and head metadata for all routes.
Why: Centralize app-wide head elements and rendering flow.
Info flow: Layout renders children -> pages render within layout.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		if (!dev && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
				// Service worker registration is best-effort.
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,700;1,9..144,800&display=swap" rel="stylesheet" />
</svelte:head>

<header class="site-nav">
	<div class="nav-inner">
		<a class="brand" href="/">
			<span class="badge">Meechie's</span>
			<span class="brand-sub">Coloring Book</span>
		</a>
		<nav class="links">
			<a href="/who-fucked-up">Who Fucked Up?</a>
			<a href="/rate-his-excuse">Rate His Excuse</a>
			<a href="/random">Random</a>
			<a href="/meechie" class="link-tools">Meechie's Tools</a>
		</nav>
	</div>
</header>

{@render children()}

<style>
	.site-nav {
		position: sticky;
		top: 0;
		z-index: 10;
		padding: 0 20px;
		border-bottom: 1px solid rgba(201, 162, 39, 0.25);
		background:
			linear-gradient(90deg, rgba(7, 7, 15, 0.98), rgba(14, 10, 24, 0.97)),
			radial-gradient(circle at 5% 0%, rgba(232, 0, 106, 0.15), transparent 50%);
		backdrop-filter: blur(12px);
		font-family: 'Barlow Condensed', 'Avenir Next Condensed', 'Avenir Next', 'Segoe UI', sans-serif;
	}

	.nav-inner {
		max-width: 1240px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		height: 56px;
	}

	.brand {
		display: inline-flex;
		align-items: baseline;
		gap: 0.55rem;
		text-decoration: none;
		flex-shrink: 0;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.3rem 0.85rem;
		font-size: 0.92rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		border-radius: 4px;
		color: #0d0a14;
		background: linear-gradient(120deg, #c9a227, #f0c44a 50%, #c9a227);
		box-shadow: 0 2px 14px rgba(201, 162, 39, 0.45);
	}

	.brand-sub {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(253, 246, 227, 0.45);
	}

	.links {
		display: flex;
		gap: 2px;
		flex-wrap: nowrap;
		align-items: center;
	}

	.links a {
		color: rgba(253, 246, 227, 0.72);
		text-decoration: none;
		font-weight: 700;
		font-size: 0.88rem;
		padding: 0.42rem 0.82rem;
		border-radius: 4px;
		border: 1px solid transparent;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
		white-space: nowrap;
	}

	.links a:hover {
		color: #f0c44a;
		background: rgba(201, 162, 39, 0.08);
		border-color: rgba(201, 162, 39, 0.3);
	}

	.links a.link-tools {
		color: #f0c44a;
		border-color: rgba(201, 162, 39, 0.4);
		background: rgba(201, 162, 39, 0.07);
	}

	.links a.link-tools:hover {
		background: rgba(201, 162, 39, 0.15);
		border-color: rgba(201, 162, 39, 0.6);
	}

	@media (max-width: 720px) {
		.site-nav {
			padding: 0 14px;
		}

		.brand-sub {
			display: none;
		}

		.links a {
			font-size: 0.78rem;
			padding: 0.38rem 0.6rem;
		}
	}

	@media (max-width: 500px) {
		.links a:not(.link-tools) {
			display: none;
		}
	}

	/* Base reset and palette */
	:global(body) {
		margin: 0;
		font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif;
		color: var(--cream);
		background: linear-gradient(180deg, #07070f, #0d0b1a 60%, #070710);
		min-height: 100vh;
		--fuchsia: #e8006a;
		--fuchsia-glow: rgba(232, 0, 106, 0.22);
		--gold: #c9a227;
		--gold-bright: #f0c44a;
		--gold-border: rgba(201, 162, 39, 0.35);
		--cream: #fdf6e3;
		--lavender: #b8aacf;
		--dark-base: #07070f;
		--dark-surface: #100f1c;
		--dark-card: #16142a;
		--dark-card-alt: #1c1932;
		--emerald: #00c896;
		--font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
		--font-label: 'Barlow Condensed', 'Avenir Next Condensed', 'Avenir Next', sans-serif;
		color-scheme: dark;
	}

	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
	}
</style>
