<!--
Purpose: Hero banner, mode-strip, and focused-mode nav links for the coloring-book studio.
Why: Extracted from +page.svelte to reduce file size while keeping all state in the parent.
Info flow: Parent passes read-only mode data and callbacks; hero is purely presentational.
Invariants: `modes` is the whole catalogue and every entry gets a card and a `/m/<slug>` link. This
            strip took three of the eight and linked only those, which left five modes — Apology
            Autopsy, Receipt Check, Clapback Card, Caption Drop and Meechie Move on the day it was
            measured — with no link anywhere in the application, while `/offline` and the 404 page
            both listed all eight. Never narrow this list again: a rotation may decide what is
            *badged*, never what exists.
            `spotlight` is null until the page has hydrated, and every badge is gated on it. `/` is
            prerendered, so a badge rendered server-side would be a claim about the build date
            sitting in a document the service worker caches and replays for days.
-->
<script lang="ts">
	import type {
		ModeSpotlight,
		StudioMode,
		StudioTextActionId
	} from '$lib/core/meechie-studio';

	let {
		modes,
		spotlight,
		spotlightNote,
		activeModeId,
		activeMode,
		isTextWorking,
		canGenerateText,
		onRunTextAction,
		onModeSelect
	}: {
		/** Every mode, in catalogue order. Never a subset — see the invariant above. */
		modes: readonly StudioMode[];
		/**
		 * Which modes are called out right now, or `null` when that is not knowable — on the
		 * server, and in the prerendered HTML an installed app opens from cache.
		 */
		spotlight: ModeSpotlight | null;
		/** The sentence explaining the badges and naming the next change. `''` before hydration. */
		spotlightNote: string;
		activeModeId: string;
		activeMode: StudioMode;
		isTextWorking: boolean;
		canGenerateText: boolean;
		onRunTextAction: (_actionId: StudioTextActionId) => Promise<void>;
		onModeSelect: (_modeId: string) => void;
	} = $props();

	// A mode is never both: `getModeSpotlight` builds `weeklyIds` out of the pool the monthly mode
	// has already been removed from, so these two branches cannot both be taken for one card.
	const isMonthly = (modeId: string): boolean => spotlight?.monthlyId === modeId;
	const isWeekly = (modeId: string): boolean =>
		spotlight?.weeklyIds.includes(modeId) ?? false;
</script>

<section
	class="hero"
	style={`background-image:
		linear-gradient(180deg, rgba(7, 7, 15, 0.1) 0%, rgba(7, 7, 15, 0.02) 34%, rgba(7, 7, 15, 0.78) 82%, rgba(7, 7, 15, 0.96) 100%),
		linear-gradient(90deg, rgba(7, 7, 15, 0.62) 0%, rgba(7, 7, 15, 0.2) 34%, rgba(7, 7, 15, 0) 58%),
		url('/meechie/meechie-banner.png');`}
>
	<div class="hero-copy">
		<p class="eyebrow">Meechies Coloring Book Generator</p>
		<h1>Meechies Coloring Book</h1>
		<p>
			Tell Meechie what happened, get the verdict and quote, then turn it into
			a printable coloring page.
		</p>
		<!--
			Points at the budget meter in `StudioInputPanel`, the same target the five buttons down
			there use. `aria-describedby` resolves across the whole document, and this button shares
			`canGenerateText` with them — including the quota guard — so without it the page's primary
			action could sit disabled with its reason announced only next to the buttons further down.
		-->
		<button
			type="button"
			class="primary"
			data-testid="home-hero-generate"
			onclick={() => onRunTextAction('generate_text')}
			disabled={!canGenerateText}
			aria-describedby="ai-budget"
		>
			{isTextWorking ? 'Reading...' : activeMode.cta}
		</button>
	</div>
</section>

<section class="mode-strip" aria-label="Choose a Meechie mode">
	{#each modes as mode, i}
		<button
			type="button"
			class="mode-card"
			class:active={activeModeId === mode.id}
			class:featured={isMonthly(mode.id) || isWeekly(mode.id)}
			data-testid={`home-mode-${mode.id}`}
			style={`--mode-color: ${mode.themeColor}; --mode-image: url('${mode.image}'); --card-index: ${i}`}
			onclick={() => onModeSelect(mode.id)}
		>
			{#if isMonthly(mode.id)}
				<span class="mode-featured-badge" data-testid={`home-mode-badge-${mode.id}`}>
					This Month
				</span>
			{:else if isWeekly(mode.id)}
				<span
					class="mode-featured-badge week"
					data-testid={`home-mode-badge-${mode.id}`}
				>
					This Week
				</span>
			{/if}
			<span class="mode-icon">{mode.icon}</span>
			<span class="mode-label">{mode.label}</span>
			<span class="mode-help">{mode.help}</span>
		</button>
	{/each}
</section>

<!--
	Rendered only once the page can answer honestly. The badges above are decoration without it:
	nothing told a reader that "This Month" was one end of a schedule rather than a label somebody
	typed, and nothing said when it moved.
-->
{#if spotlightNote}
	<p class="mode-schedule" data-testid="home-mode-schedule">{spotlightNote}</p>
{/if}

<nav class="focused-mode-links" aria-label="Open a focused Meechie mode">
	{#each modes as mode}
		<a href={`/m/${mode.id}`}>{mode.shortLabel}</a>
	{/each}
</nav>
