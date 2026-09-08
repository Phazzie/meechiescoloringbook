<!--
Purpose: `/describe` — the one surface in the app where the reader says what the page should be
         instead of picking a question Meechie already wrote.
Why: `ChatInterpretationSeam` shipped with the app's first weeks and had no caller anywhere in
     `src/routes/**` or `src/lib/components/**`: a complete, tested, quota-metered pipeline behind a
     live endpoint that no reader could reach. This route is its front door.
Info flow: DescribePageState -> /api/chat-interpretation -> read-back -> /api/generate ->
           downloads, print, share, vault.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import DescribePageStudio from '$lib/components/DescribePageStudio.svelte';
	import { DescribePageState } from '$lib/components/describe-page-state.svelte';

	const studio = new DescribePageState();

	// The quota reading arms a `ClockSeam` timer so it stops being shown the moment it stops being
	// true. Leaving the route without releasing it would leave that timer holding this instance.
	onDestroy(() => studio.dispose());
</script>

<svelte:head>
	<title>Describe Your Page — Meechie's Coloring Book</title>
	<meta
		name="description"
		content="Say what your coloring page should be, in your own words. Meechie reads it back before a single line gets drawn."
	/>
</svelte:head>

<main data-testid="describe-root">
	<DescribePageStudio {studio} />
</main>
