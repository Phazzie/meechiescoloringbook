<!--
Purpose: The one route behind every focused mode page, `/m/<slug>`.
Why: Keep one mode implementation rather than one route per mode. The mode itself is resolved in
     `+page.ts`, so by the time this renders the slug is known to exist.
Info flow: Resolved slug -> mode catalog -> MeechieModePage.
-->
<script lang="ts">
	import MeechieModePage from '$lib/components/MeechieModePage.svelte';
	import { resolveModeSlug } from '$lib/core/mode-catalog';

	let { data }: { data: { mode: string } } = $props();

	// Non-null: `load` already 404s on a slug that does not resolve, so this cannot miss. The `!`
	// would hide a real failure if that ever stopped being true, so fall back to the first mode
	// instead — a wrong-but-rendering page beats a blank one, and the test suite asserts every
	// catalogued slug resolves so the fallback stays unreachable.
	const config = $derived(resolveModeSlug(data.mode));
</script>

<svelte:head>
	<title>{config?.title ?? 'Meechie'} — Meechie's Coloring Book</title>
</svelte:head>

{#if config}
	<!-- Keyed on the slug so navigating between two modes builds a fresh page. SvelteKit reuses one
	     component instance across parameter changes on the same route, and `MeechieModePage` owns a
	     `VerdictPageState` created once per instance — without this key, going from `/m/clapback` to
	     `/m/receipt-check` would keep the clapback verdict on screen under the new mode's title, and
	     the coloring page it made would still download as `meechie-clapback-*.pdf`. -->
	{#key config.slug}
		<MeechieModePage {config} />
	{/key}
{/if}
