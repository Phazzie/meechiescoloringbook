<!--
Purpose: "Random Meechie" mode — one tap, one truth, and a coloring page you can keep.
Why: One of the app's four nav destinations. Its saying was flattened into a title-only page, the
     drift report was thrown away, and nothing it produced could reach the Quote Vault — so the
     page a user paid a generation for survived exactly as long as the tab did. The lifecycle now
     lives in `VerdictPageState`, shared with the other modes.
Info flow: Tap -> VerdictPageState.requestVerdict (random_meechie) -> saying -> VerdictPageStudio
           -> coloring page, downloads, vault.
-->
<script lang="ts">
	import VerdictPageStudio from '$lib/components/VerdictPageStudio.svelte';
	import { VerdictPageState } from '$lib/components/verdict-page-state.svelte';

	const studio = new VerdictPageState({ fileBaseSlug: 'random' });

	const tap = async (): Promise<void> => {
		const installed = await studio.requestVerdict({ toolId: 'random_meechie' });
		// A new saying is a new subject, so a dedication chosen for the previous one must not ride
		// along and end up printed on, downloaded with, or saved against a saying it was never meant
		// for. Cleared only once a replacement has actually arrived: a failed tap keeps the saying
		// and its page exactly as they were, dedication included.
		//
		// The two other mode routes deliberately do *not* do this. "Ask her again" and "Re-run the
		// ruling" re-ask about the same situation, so the dedication still belongs to it.
		if (installed) studio.setDedication('');
	};
</script>

<svelte:head>
	<title>Random Meechie — Meechie's Coloring Book</title>
</svelte:head>

<div class="page">
	<div class="ambient ambient-a" aria-hidden="true"></div>
	<div class="ambient ambient-b" aria-hidden="true"></div>

	{#if !studio.verdict && !studio.isWorking}
		<header class="hero">
			<p class="crown" aria-hidden="true">✦</p>
			<h1>Random Meechie</h1>
			<p class="subhead">One tap. One truth. No context required.</p>
		</header>

		<div class="tap-zone">
			{#if studio.error}
				<p class="error" data-testid="random-error">{studio.error}</p>
			{/if}
			<button
				type="button"
				class="tap-cta"
				data-testid="random-tap"
				onclick={() => void tap()}
				aria-label="Get a Meechie saying"
			>
				Tap For Truth
			</button>
			<p class="tap-hint">No explanation needed. She already knows.</p>
		</div>
	{:else if !studio.verdict}
		<div class="loading-zone" aria-live="polite" aria-busy="true">
			<p class="loading-crown" aria-hidden="true">♛</p>
			<p class="loading-text">She's deciding what you need to hear...</p>
		</div>
	{:else}
		<header class="saying-hero">
			<p class="eyebrow">Meechie Says</p>
			<blockquote class="saying" data-testid="random-result">
				{studio.verdict.response}
			</blockquote>
			<div class="saying-actions">
				<!-- Deliberately not a reset. The previous saying and the page built from it stay on
				     screen until the replacement actually lands, so a failed tap costs nothing. -->
				<button
					type="button"
					class="ghost-btn"
					data-testid="random-another"
					onclick={() => void tap()}
					disabled={studio.isWorking || studio.isGenerating}
				>
					{studio.isWorking ? 'Deciding…' : 'Another one'}
				</button>
			</div>
			{#if studio.error}
				<p class="error" data-testid="random-error">{studio.error}</p>
			{/if}
		</header>

		<VerdictPageStudio
			{studio}
			heading="Generate the Coloring Page"
			subheading="Print it. Color it. Send it to whoever needs to see it."
		/>
	{/if}
</div>

<style>
	.page {
		/* The ambient decoration sits 2rem past the page's right edge. Below the 680px maximum the
		   page fills the viewport, so that overhang — plus its blur — became 32px of real document
		   width, and every one of these pages could be panned sideways into blank space on a phone.
		   `clip` rather than `hidden`: `hidden` would make this a scroll container on both axes. */
		overflow-x: clip;
		position: relative;
		max-width: 680px;
		margin: 0 auto;
		padding: 2.5rem 1.4rem 5rem;
		min-height: 100vh;
		background:
			radial-gradient(
				circle at 50% 0%,
				rgba(107, 33, 168, 0.22),
				transparent 48%
			),
			radial-gradient(
				circle at 10% 80%,
				rgba(232, 0, 106, 0.14),
				transparent 45%
			);
	}

	.ambient {
		position: absolute;
		pointer-events: none;
		filter: blur(10px);
		z-index: 0;
	}

	.ambient-a {
		top: 3rem;
		left: -3rem;
		width: clamp(140px, 20vw, 260px);
		aspect-ratio: 1;
		border-radius: 46% 54% 54% 46%;
		background: linear-gradient(
			145deg,
			rgba(107, 33, 168, 0.28),
			rgba(232, 0, 106, 0.14)
		);
	}

	.ambient-b {
		bottom: 8rem;
		right: -2rem;
		width: clamp(120px, 18vw, 230px);
		aspect-ratio: 1;
		border-radius: 54% 46% 44% 56%;
		background: linear-gradient(
			145deg,
			rgba(201, 162, 39, 0.2),
			rgba(107, 33, 168, 0.12)
		);
	}

	.hero {
		position: relative;
		z-index: 1;
		text-align: center;
		padding: 1.5rem 0 2rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid rgba(107, 33, 168, 0.3);
	}

	.crown {
		margin: 0 0 0.7rem;
		font-size: 2.4rem;
		line-height: 1;
		filter: drop-shadow(0 0 16px rgba(184, 170, 207, 0.5));
	}

	h1 {
		margin: 0 0 0.7rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(2.4rem, 7vw, 3.8rem);
		font-style: italic;
		font-weight: 800;
		line-height: 0.92;
		letter-spacing: -0.02em;
		color: var(--cream);
	}

	.subhead {
		margin: 0;
		font-size: 1rem;
		line-height: 1.5;
		color: var(--lavender);
	}

	.tap-zone {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 0;
	}

	.tap-cta {
		border: none;
		border-radius: 999px;
		padding: 1.2rem 3rem;
		background: linear-gradient(112deg, #6b21a8, #e8006a 55%, #c9a227);
		color: #fff;
		font-weight: 800;
		font-size: 1.2rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
		box-shadow: 0 10px 32px rgba(107, 33, 168, 0.4);
	}

	.tap-cta:hover {
		transform: translateY(-3px);
		box-shadow: 0 18px 48px rgba(107, 33, 168, 0.5);
		filter: saturate(1.1) brightness(1.08);
	}

	.tap-hint {
		margin: 0;
		font-size: 0.82rem;
		color: rgba(184, 170, 207, 0.5);
		font-style: italic;
	}

	/* Loading */
	.loading-zone {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 0;
		text-align: center;
	}

	.loading-crown {
		margin: 0;
		font-size: 3rem;
		animation: pulse 1.4s ease-in-out infinite;
		filter: drop-shadow(0 0 12px rgba(201, 162, 39, 0.5));
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	.loading-text {
		margin: 0;
		font-size: 1rem;
		color: var(--lavender);
		font-style: italic;
	}

	/* Saying display */
	.saying-hero {
		position: relative;
		z-index: 1;
		margin-bottom: 2rem;
		padding-bottom: 1.6rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.25);
	}

	.eyebrow {
		margin: 0 0 0.8rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--lavender);
	}

	.saying {
		margin: 0 0 1.4rem;
		padding: 0;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(1.5rem, 5vw, 2.4rem);
		font-style: italic;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: var(--cream);
		text-shadow: 0 0 30px rgba(184, 170, 207, 0.2);
	}

	.saying-actions {
		display: flex;
		gap: 0.8rem;
		align-items: center;
	}

	.ghost-btn {
		background: transparent;
		border: 1px solid var(--gold-border);
		border-radius: 999px;
		padding: 0.5rem 1rem;
		color: var(--gold-bright);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	.ghost-btn:hover:not(:disabled) {
		border-color: var(--gold);
	}

	.ghost-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.error {
		margin: 1rem 0 0;
		padding: 0.7rem 1rem;
		border-radius: 0.6rem;
		background: rgba(232, 0, 106, 0.1);
		border: 1px solid rgba(232, 0, 106, 0.3);
		font-size: 0.88rem;
		color: #ff8fab;
	}

	@media (max-width: 600px) {
		.page {
			padding: 1.6rem 1rem 4rem;
		}
	}
</style>
