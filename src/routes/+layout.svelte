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
</svelte:head>

<header class="site-nav">
	<div class="nav-inner">
		<a class="brand" href="/">
			<span class="badge">Meechie's</span>
		</a>
		<nav class="links">
			<a href="/">Create</a>
			<a href="/meechie">Talk To Meechie</a>
		</nav>
	</div>
</header>

{@render children()}

<style>
	.site-nav {
		position: sticky;
		top: 0;
		z-index: 10;
		padding: 14px 20px;
		border-bottom: 1px solid rgba(201, 162, 39, 0.35);
		background:
			linear-gradient(90deg, rgba(7, 7, 15, 0.97), rgba(14, 10, 24, 0.96)),
			radial-gradient(circle at 10% 0%, rgba(232, 0, 106, 0.18), transparent 45%);
		backdrop-filter: blur(8px);
		font-family: 'Barlow Condensed', 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif;
	}

	.nav-inner {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		font-size: 0.95rem;
		text-decoration: none;
		color: #fdf6e3;
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.38rem 0.9rem;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		border-radius: 999px;
		color: #0d0a14;
		background: linear-gradient(120deg, #c9a227, #f0c44a, #c9a227);
		box-shadow: 0 4px 18px rgba(201, 162, 39, 0.4);
	}

	.links {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.links a {
		color: #fdf6e3;
		text-decoration: none;
		font-weight: 700;
		font-size: 0.84rem;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		border: 1px solid transparent;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		transition: border-color 0.2s ease, background-color 0.2s ease;
	}

	.links a:hover {
		border-color: rgba(201, 162, 39, 0.55);
		background: rgba(201, 162, 39, 0.1);
		color: #f0c44a;
	}

	@media (max-width: 720px) {
		.site-nav {
			padding: 12px 14px;
		}

		.badge {
			font-size: 0.78rem;
			padding: 0.32rem 0.7rem;
		}
	}
</style>
