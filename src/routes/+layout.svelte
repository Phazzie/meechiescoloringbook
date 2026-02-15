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
			<span class="badge">Meechie</span>
			<span>Studio Console</span>
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
		border-bottom: 1px solid rgba(255, 201, 115, 0.3);
		background:
			linear-gradient(90deg, rgba(19, 18, 21, 0.94), rgba(27, 21, 30, 0.93)),
			radial-gradient(circle at 10% 0%, rgba(255, 86, 143, 0.2), transparent 45%);
		backdrop-filter: blur(6px);
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
		letter-spacing: 0.05em;
		font-size: 0.95rem;
		text-decoration: none;
		color: #fffbf2;
		text-transform: uppercase;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.65rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		border-radius: 999px;
		color: #2b1c13;
		background: linear-gradient(120deg, #ffd57b, #ff8ab3);
		box-shadow: 0 6px 14px rgba(255, 138, 179, 0.3);
	}

	.links {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.links a {
		color: #f8e6cf;
		text-decoration: none;
		font-weight: 700;
		font-size: 0.84rem;
		padding: 0.45rem 0.85rem;
		border-radius: 999px;
		border: 1px solid transparent;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
	}

	.links a:hover {
		border-color: rgba(255, 205, 128, 0.5);
		background: rgba(255, 205, 128, 0.12);
		color: #fff4df;
	}

	@media (max-width: 720px) {
		.site-nav {
			padding: 12px 14px;
		}

		.brand {
			font-size: 0.8rem;
		}

		.badge {
			padding-inline: 0.5rem;
		}
	}
</style>
