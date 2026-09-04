<!--
Purpose: "Who Fucked Up?" mode — user describes a situation, Meechie states what it really means,
         and the verdict becomes a coloring page you can keep.
Why: This route is one of the app's four nav destinations and it used to dead-end at a page you
     could download once and never see again: the verdict was flattened into a title-only page
     whatever structure it came back in, the drift report was discarded, and nothing could reach
     the Quote Vault. All of that now lives in `VerdictPageState`, shared with the other modes.
Info flow: Situation input -> VerdictPageState.requestVerdict (red_flag_or_run) -> verdict ->
           VerdictPageStudio -> coloring page, downloads, vault.
-->
<script lang="ts">
	import VerdictPageStudio from '$lib/components/VerdictPageStudio.svelte';
	import { VerdictPageState } from '$lib/components/verdict-page-state.svelte';

	const studio = new VerdictPageState({ fileBaseSlug: 'who-fucked-up' });

	let situation = $state('');

	const submit = (): void => {
		if (!situation.trim()) return;
		void studio.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: situation.trim()
		});
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
	};

	const startOver = (): void => {
		situation = '';
		studio.reset();
	};
</script>

<svelte:head>
	<title>Who Fucked Up? — Meechie's Coloring Book</title>
</svelte:head>

<div class="page">
	<div class="ambient ambient-a" aria-hidden="true"></div>

	{#if !studio.verdict}
		<header class="hero">
			<p class="eyebrow">Mode One</p>
			<h1>Who Fucked Up?</h1>
			<p class="subhead">
				Tell Meechie what happened. She'll tell you what it really means.
			</p>
		</header>

		<section class="input-card">
			<label for="situation" class="input-label">What did they do?</label>
			<textarea
				id="situation"
				data-testid="who-situation-input"
				bind:value={situation}
				onkeydown={handleKeydown}
				rows="5"
				placeholder="He said his phone died but I saw him active on Instagram at midnight..."
			></textarea>
			<p class="key-hint">Ctrl + Enter to submit</p>

			{#if studio.error}
				<p class="error" data-testid="who-error">{studio.error}</p>
			{/if}

			<button
				type="button"
				class="cta"
				data-testid="who-submit"
				onclick={submit}
				disabled={studio.isWorking || !situation.trim()}
			>
				{studio.isWorking ? "She's reading it..." : "She's listening. Go."}
			</button>
		</section>
	{:else}
		<header class="verdict-hero">
			<p class="eyebrow">Meechie's Observation</p>
			<div class="verdict-badge">{studio.verdict.headline}</div>
			<p class="verdict-response" data-testid="who-result">
				{studio.verdict.response}
			</p>
			<div class="verdict-actions">
				<button
					type="button"
					class="ghost-btn"
					data-testid="who-reset"
					onclick={startOver}>← Different situation</button
				>
				<button
					type="button"
					class="ghost-btn"
					data-testid="who-again"
					onclick={submit}
					disabled={studio.isWorking}
				>
					{studio.isWorking ? 'Reading it again…' : 'Ask her again'}
				</button>
			</div>
			{#if studio.error}
				<p class="error" data-testid="who-error">{studio.error}</p>
			{/if}
		</header>

		<VerdictPageStudio
			{studio}
			subheading="The verdict becomes the page. Print it. Color it. Dedicate it."
			dedicationPlaceholder="He had time to learn."
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
			radial-gradient(circle at 0% 0%, rgba(232, 0, 106, 0.2), transparent 40%),
			radial-gradient(
				circle at 100% 60%,
				rgba(107, 33, 168, 0.18),
				transparent 45%
			);
	}

	.ambient {
		position: absolute;
		pointer-events: none;
		filter: blur(9px);
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
			rgba(232, 0, 106, 0.28),
			rgba(107, 33, 168, 0.15)
		);
	}

	.hero {
		position: relative;
		z-index: 1;
		margin-bottom: 2rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(232, 0, 106, 0.25);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--fuchsia);
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
		border: 1px solid rgba(232, 0, 106, 0.3);
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
		border-color: var(--fuchsia);
		box-shadow: 0 0 0 3px rgba(232, 0, 106, 0.15);
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
		background: linear-gradient(112deg, #e8006a, #6b21a8 55%, #c9a227);
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
		box-shadow: 0 16px 36px rgba(232, 0, 106, 0.4);
		filter: saturate(1.1) brightness(1.05);
	}

	.cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* Verdict screen */
	.verdict-hero {
		position: relative;
		z-index: 1;
		margin-bottom: 2rem;
		padding-bottom: 1.6rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.25);
	}

	.verdict-badge {
		margin: 0.6rem 0 1rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: clamp(2rem, 6vw, 3.2rem);
		font-style: italic;
		font-weight: 800;
		line-height: 1.05;
		color: var(--gold-bright);
		text-shadow: 0 0 30px rgba(240, 196, 74, 0.3);
	}

	.verdict-response {
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
