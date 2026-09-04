<!--
Purpose: "Rate His Excuse" mode — user provides an excuse, Meechie scores it 1-10 with commentary,
         and the ruling becomes a coloring page you can keep.
Why: One of the app's four nav destinations. It used to flatten every ruling into a title-only page
     regardless of the structure Meechie answered in, discard the drift report, and offer no way to
     save the page it charged a generation for. The lifecycle now lives in `VerdictPageState`,
     shared with the other modes, so the score leads the page and the page reaches the vault.
Info flow: Excuse input -> VerdictPageState.requestVerdict (rate_excuse) -> scored ruling ->
           VerdictPageStudio -> coloring page, downloads, vault.
-->
<script lang="ts">
	import VerdictPageStudio from '$lib/components/VerdictPageStudio.svelte';
	import { VerdictPageState } from '$lib/components/verdict-page-state.svelte';

	const studio = new VerdictPageState({ fileBaseSlug: 'rate-his-excuse' });

	let excuse = $state('');
	/**
	 * The excuse the ruling on screen was actually passed. Echoing the live `excuse` box instead
	 * would let an edit made after the ruling arrived reattach Meechie's words to a different
	 * excuse — the ruling would appear to be about text she never saw.
	 */
	let ruledExcuse = $state('');

	const submit = async (): Promise<void> => {
		const trimmed = excuse.trim();
		if (!trimmed) return;
		const previous = studio.verdict;
		await studio.requestVerdict({ toolId: 'rate_excuse', excuse: trimmed });
		// Relabel only when a genuinely new ruling arrived. A failed re-run deliberately leaves the
		// previous ruling on screen, and that ruling belongs to the previous excuse — echoing the
		// new text above it would attribute Meechie's words to something she never read.
		if (studio.verdict !== null && studio.verdict !== previous)
			ruledExcuse = trimmed;
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey))
			void submit();
	};

	const startOver = (): void => {
		excuse = '';
		ruledExcuse = '';
		studio.reset();
	};

	const ratingScore = $derived(studio.verdict?.rating ?? null);
	const ratingColor = $derived(
		ratingScore === null
			? 'var(--cream)'
			: ratingScore <= 3
				? '#e8006a'
				: ratingScore <= 6
					? '#c9a227'
					: '#b8aacf'
	);
</script>

<svelte:head>
	<title>Rate His Excuse — Meechie's Coloring Book</title>
</svelte:head>

<div class="page">
	<div class="ambient ambient-a" aria-hidden="true"></div>

	{#if !studio.verdict}
		<header class="hero">
			<p class="eyebrow">Mode Two</p>
			<h1>Rate His Excuse</h1>
			<p class="subhead">
				Drop the excuse. Meechie scores it. No soft landing.
			</p>
		</header>

		<section class="input-card">
			<label for="excuse" class="input-label"
				>What excuse did he give you?</label
			>
			<textarea
				id="excuse"
				data-testid="rate-excuse-input"
				bind:value={excuse}
				onkeydown={handleKeydown}
				rows="4"
				placeholder="My phone died. I was with the guys. I was working late..."
			></textarea>
			<p class="key-hint">Ctrl + Enter to submit</p>

			{#if studio.error}
				<p class="error" data-testid="rate-error">{studio.error}</p>
			{/if}

			<button
				type="button"
				class="cta"
				data-testid="rate-submit"
				onclick={() => void submit()}
				disabled={studio.isWorking || !excuse.trim()}
			>
				{studio.isWorking ? 'Court is reviewing...' : 'Let Meechie Hear It'}
			</button>
		</section>
	{:else}
		<header class="verdict-hero">
			<p class="eyebrow">Meechie's Ruling</p>
			<p class="excuse-echo">"{ruledExcuse}"</p>

			<div class="score-display">
				<span class="score-number" style="color: {ratingColor}"
					>{ratingScore ?? studio.verdict.headline}</span
				>
				<span class="score-label">out of 10</span>
			</div>

			<p class="verdict-commentary" data-testid="rate-result">
				{studio.verdict.response}
			</p>
			<div class="verdict-actions">
				<button
					type="button"
					class="ghost-btn"
					data-testid="rate-reset"
					onclick={startOver}>← Different excuse</button
				>
				<button
					type="button"
					class="ghost-btn"
					data-testid="rate-again"
					onclick={() => void submit()}
					disabled={studio.isWorking}
				>
					{studio.isWorking ? 'Court is reviewing…' : 'Re-run the ruling'}
				</button>
			</div>
			{#if studio.error}
				<p class="error" data-testid="rate-error">{studio.error}</p>
			{/if}
		</header>

		<VerdictPageStudio
			{studio}
			heading="Generate the Coloring Page"
			subheading="The ruling becomes the page. Print it. Dedicate it."
			dedicationPlaceholder="He had time to do better."
		/>
	{/if}
</div>

<style>
	.page {
		position: relative;
		max-width: 680px;
		margin: 0 auto;
		padding: 2.5rem 1.4rem 5rem;
		min-height: 100vh;
		background:
			radial-gradient(
				circle at 100% 0%,
				rgba(201, 162, 39, 0.16),
				transparent 42%
			),
			radial-gradient(
				circle at 0% 80%,
				rgba(107, 33, 168, 0.18),
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
		top: 2rem;
		right: -2rem;
		width: clamp(160px, 24vw, 300px);
		aspect-ratio: 1;
		border-radius: 46% 54% 54% 46%;
		background: linear-gradient(
			145deg,
			rgba(201, 162, 39, 0.22),
			rgba(107, 33, 168, 0.14)
		);
	}

	.hero {
		position: relative;
		z-index: 1;
		margin-bottom: 2rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.25);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--gold);
	}

	h1 {
		margin: 0 0 0.6rem;
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

	.input-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.input-label {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold);
	}

	textarea {
		border-radius: 0.9rem;
		border: 1px solid rgba(201, 162, 39, 0.3);
		padding: 1rem 1.1rem;
		font-size: 1.05rem;
		font-family: inherit;
		line-height: 1.5;
		color: var(--cream);
		background: rgba(7, 7, 15, 0.7);
		resize: vertical;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	textarea:focus {
		outline: none;
		border-color: var(--gold);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.15);
	}

	textarea::placeholder {
		color: rgba(184, 170, 207, 0.4);
	}

	.key-hint {
		margin: 0;
		font-size: 0.72rem;
		color: rgba(184, 170, 207, 0.4);
		text-align: right;
	}

	.cta {
		width: 100%;
		border: none;
		border-radius: 999px;
		padding: 1rem 1.6rem;
		background: linear-gradient(112deg, #c9a227, #6b21a8 55%, #e8006a);
		color: #fff;
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
	}

	.cta:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 16px 36px rgba(201, 162, 39, 0.35);
		filter: saturate(1.1) brightness(1.05);
	}

	.cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* Verdict */
	.verdict-hero {
		position: relative;
		z-index: 1;
		margin-bottom: 2rem;
		padding-bottom: 1.6rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.25);
	}

	.excuse-echo {
		margin: 0.4rem 0 1.2rem;
		font-size: 1rem;
		font-style: italic;
		color: var(--lavender);
		line-height: 1.4;
	}

	.score-display {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.score-number {
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(4rem, 14vw, 7rem);
		font-weight: 800;
		line-height: 0.9;
		letter-spacing: -0.04em;
		text-shadow: 0 0 40px currentColor;
	}

	.score-label {
		font-size: 1rem;
		font-weight: 600;
		color: var(--lavender);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.verdict-commentary {
		margin: 0 0 1.2rem;
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--cream);
	}

	.verdict-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
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
		margin: 0;
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
