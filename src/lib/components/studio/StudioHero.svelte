<!--
Purpose: Hero banner, mode-strip, and focused-mode nav links for the coloring-book studio.
Why: Extracted from +page.svelte to reduce file size while keeping all state in the parent.
Info flow: Parent passes read-only mode data and callbacks; hero is purely presentational.
-->
<script lang="ts">
	import type {
		StudioMode,
		StudioTextActionId
	} from '$lib/core/meechie-studio';

	let {
		weeklyModes,
		monthlyModeId,
		activeModeId,
		activeMode,
		isTextWorking,
		canGenerateText,
		onRunTextAction,
		onModeSelect
	}: {
		weeklyModes: StudioMode[];
		monthlyModeId: string;
		activeModeId: string;
		activeMode: StudioMode;
		isTextWorking: boolean;
		canGenerateText: boolean;
		onRunTextAction: (_actionId: StudioTextActionId) => Promise<void>;
		onModeSelect: (_modeId: string) => void;
	} = $props();
</script>

<section
	class="hero"
	style={`background-image: linear-gradient(90deg, rgba(7, 7, 15, 0.94), rgba(7, 7, 15, 0.25)), url('/meechie/meechie-banner.png');`}
>
	<div class="hero-copy">
		<p class="eyebrow">
			Adult Relationship Verdict & Statement Line-Art Studio
		</p>
		<h1>Meechie's Coloring Book</h1>
		<p>
			Tell Meechie what happened. Get the verdict, name who crossed the line,
			and turn consequences into printable statement line-art coloring pages.
		</p>
		<button
			type="button"
			class="primary"
			data-testid="home-hero-generate"
			onclick={() => onRunTextAction('generate_text')}
			disabled={!canGenerateText}
		>
			{isTextWorking ? 'Reading...' : activeMode.cta}
		</button>
	</div>
</section>

<section class="mode-strip" aria-label="Choose a Meechie mode">
	{#each weeklyModes as mode, i}
		<button
			type="button"
			class="mode-card"
			class:active={activeModeId === mode.id}
			class:featured={mode.id === monthlyModeId}
			data-testid={`home-mode-${mode.id}`}
			style={`--mode-color: ${mode.themeColor}; --mode-image: url('${mode.image}'); --card-index: ${i}`}
			onclick={() => onModeSelect(mode.id)}
		>
			{#if mode.id === monthlyModeId}
				<span class="mode-featured-badge">This Month</span>
			{/if}
			<span class="mode-icon">{mode.icon}</span>
			<span class="mode-label">{mode.label}</span>
			<span class="mode-help">{mode.help}</span>
		</button>
	{/each}
</section>

<nav class="focused-mode-links" aria-label="Open a focused Meechie mode">
	{#each weeklyModes as mode}
		<a href={`/m/${mode.id}`}>{mode.shortLabel}</a>
	{/each}
</nav>
