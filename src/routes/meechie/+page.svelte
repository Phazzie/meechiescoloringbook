<!--
Purpose: Provide a direct route to Meechie tools while the main UI hosts the primary entry.
Why: Preserve deep links while keeping the tools accessible on the main page.
Info flow: Route -> MeechieTools component -> MeechieToolSeam.
-->
<script lang="ts">
	import MeechieTools from '$lib/components/MeechieTools.svelte';
</script>

<svelte:head>
	<title>Meechie Tools</title>
</svelte:head>

<MeechieTools />
