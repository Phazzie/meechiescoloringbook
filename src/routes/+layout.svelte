<!--
Purpose: Shared layout wrapper and head metadata for all routes.
Why: Centralize app-wide head elements and rendering flow.
Info flow: Layout renders children -> pages render within layout.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator) {
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
	<div class="brand">Coloring Book Generator</div>
	<nav class="links">
		<a href="/">Pages</a>
	</nav>
</header>

{@render children()}

<style>
	.site-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #e2d4c5;
		background: #fffaf4;
		font-family: "Space Grotesk", "DM Sans", system-ui, sans-serif;
	}

	.brand {
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-size: 0.85rem;
	}

	.links {
		display: flex;
		gap: 16px;
	}

	.links a {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
	}
</style>
