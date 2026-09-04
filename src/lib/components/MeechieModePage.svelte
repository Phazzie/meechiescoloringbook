<!--
Purpose: The focused single-mode page behind every `/m/<slug>` URL — ask the mode's question, show
         Meechie's verdict, and turn that verdict into a coloring page you can print, download and
         keep.
Why: This is the only page five of the eight modes have, and it is where every focused-mode link on
     the home page lands. It used to stop at the verdict: the response was dumped into a `<pre>`,
     the component carried no styling at all in an app that is otherwise entirely styled, and there
     was no way to make a page, download one, or save one — in an app whose single purpose is
     printable coloring pages. Everything after the verdict now comes from `VerdictPageState` and
     `VerdictPageStudio`, shared with the three standalone mode routes.
Info flow: ModeConfig + reader's answers -> VerdictPageState.requestVerdict -> verdict ->
           VerdictPageStudio -> coloring page, downloads, vault.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import VerdictPageStudio from '$lib/components/VerdictPageStudio.svelte';
	import { VerdictPageState } from '$lib/components/verdict-page-state.svelte';
	import {
		emptyModeFieldValues,
		isModeInputComplete,
		modeCatalog,
		type ModeConfig
	} from '$lib/core/mode-catalog';

	let { config }: { config: ModeConfig } = $props();

	// Every other mode, so a reader who has finished here has somewhere to go. Five of the eight
	// modes have no page but this one, and the only way out used to be back to the home page.
	const otherModes = $derived(
		modeCatalog().filter((mode) => mode.slug !== config.slug)
	);

	// One state object per mounted mode, deliberately built from the slug this component mounted
	// with. `untrack` states that: the route keys this component on the slug, so a different mode is
	// a different instance and this value cannot go stale. If that key were ever removed the download
	// filename here would silently keep naming the previous mode, which is why an end-to-end test
	// walks between two modes rather than trusting the key to stay put.
	const studio = new VerdictPageState({
		fileBaseSlug: untrack(() => config.slug)
	});

	let values = $state(emptyModeFieldValues());

	const canSubmit = $derived(isModeInputComplete(config, values));

	const submit = (): void => {
		if (!canSubmit) return;
		void studio.requestVerdict(config.buildInput(values));
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
	};

	const startOver = (): void => {
		values = emptyModeFieldValues();
		studio.reset();
	};
</script>

<div class="page">
	<div class="ambient" aria-hidden="true"></div>

	{#if !studio.verdict}
		<header class="hero">
			<p class="eyebrow">Focused Mode</p>
			<h1>{config.title}</h1>
			<p class="subhead">{config.subhead}</p>
		</header>

		<section class="input-card">
			{#each config.fields as field (field.id)}
				<div class="field">
					<label class="field-label" for={`mode-field-${field.id}`}>
						{field.label}
					</label>
					{#if field.multiline}
						<textarea
							id={`mode-field-${field.id}`}
							data-testid={`mode-field-${field.id}`}
							bind:value={values[field.id]}
							onkeydown={handleKeydown}
							rows="4"
							placeholder={field.placeholder}
						></textarea>
					{:else}
						<input
							id={`mode-field-${field.id}`}
							data-testid={`mode-field-${field.id}`}
							type="text"
							bind:value={values[field.id]}
							onkeydown={handleKeydown}
							placeholder={field.placeholder}
						/>
					{/if}
				</div>
			{/each}

			{#if config.fields.length > 0}
				<p class="key-hint">Ctrl + Enter to submit</p>
			{:else}
				<p class="no-input-hint">
					No setup needed. Meechie pulls the line herself.
				</p>
			{/if}

			{#if studio.error}
				<p class="error" data-testid="mode-error">{studio.error}</p>
			{/if}

			<button
				type="button"
				class="cta"
				data-testid="mode-submit"
				onclick={submit}
				disabled={studio.isWorking || !canSubmit}
			>
				{studio.isWorking ? "She's reading it…" : config.button}
			</button>
		</section>
	{:else}
		<header class="verdict-hero">
			<p class="eyebrow">{config.title}</p>
			<div class="verdict-badge" data-testid="mode-headline">
				{studio.verdict.headline}
			</div>
			<p class="verdict-response" data-testid="mode-result">
				{studio.verdict.response}
			</p>
			<div class="verdict-actions">
				<button
					type="button"
					class="ghost-btn"
					data-testid="mode-reset"
					onclick={startOver}
				>
					← Start over
				</button>
				<button
					type="button"
					class="ghost-btn"
					data-testid="mode-again"
					onclick={submit}
					disabled={studio.isWorking || studio.isGenerating || !canSubmit}
				>
					{studio.isWorking ? 'Reading it again…' : 'Ask her again'}
				</button>
			</div>
			{#if studio.error}
				<p class="error" data-testid="mode-error">{studio.error}</p>
			{/if}
		</header>

		<VerdictPageStudio
			{studio}
			subheading="The verdict becomes the page. Print it. Color it. Dedicate it."
		/>
	{/if}

	<nav class="other-modes" aria-label="Other Meechie modes">
		<p class="other-modes-title">Ask her something else</p>
		<ul>
			{#each otherModes as mode (mode.slug)}
				<li>
					<a href={`/m/${mode.slug}`} data-testid={`mode-link-${mode.slug}`}>
						{mode.title}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
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
		pointer-events: none;
		filter: blur(9px);
		z-index: 0;
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
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--fuchsia, #e8006a);
	}

	h1 {
		margin: 0 0 0.6rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: clamp(2.4rem, 7vw, 3.8rem);
		font-style: italic;
		font-weight: 800;
		line-height: 0.92;
		letter-spacing: -0.02em;
		color: var(--cream, #fdf6e3);
	}

	.subhead {
		margin: 0;
		font-size: 1rem;
		line-height: 1.5;
		color: var(--lavender, #b8aacf);
	}

	.input-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold, #c9a227);
	}

	textarea,
	input[type='text'] {
		border-radius: 0.9rem;
		border: 1px solid rgba(232, 0, 106, 0.3);
		padding: 1rem 1.1rem;
		font-size: 1.05rem;
		font-family: inherit;
		line-height: 1.5;
		color: var(--cream, #fdf6e3);
		background: rgba(7, 7, 15, 0.7);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	textarea {
		resize: vertical;
	}

	textarea:focus,
	input[type='text']:focus {
		outline: none;
		border-color: var(--fuchsia, #e8006a);
		box-shadow: 0 0 0 3px rgba(232, 0, 106, 0.15);
	}

	textarea::placeholder,
	input[type='text']::placeholder {
		color: rgba(184, 170, 207, 0.4);
	}

	.key-hint {
		margin: 0;
		font-size: 0.72rem;
		color: rgba(184, 170, 207, 0.4);
		text-align: right;
	}

	.no-input-hint {
		margin: 0;
		font-size: 0.9rem;
		color: var(--lavender, #b8aacf);
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

	.verdict-hero {
		position: relative;
		z-index: 1;
		margin-bottom: 2rem;
		padding-bottom: 1.6rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.25);
	}

	.verdict-badge {
		margin: 0.6rem 0 1rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: clamp(2rem, 6vw, 3.2rem);
		font-style: italic;
		font-weight: 800;
		line-height: 1.05;
		color: var(--gold-bright, #f0c44a);
		text-shadow: 0 0 30px rgba(240, 196, 74, 0.3);
	}

	.verdict-response {
		margin: 0 0 1.2rem;
		font-size: 1.05rem;
		line-height: 1.55;
		/* `white-space: pre-line` rather than a `<pre>`: several tools answer in newline-separated
		   beats ("Fault:" / "Consequence:" / "Move:") and that structure is worth keeping, but a
		   `<pre>` also keeps monospace and refuses to wrap, so a long verdict ran off the side of a
		   phone with no way to read the end of it. */
		white-space: pre-line;
		color: var(--cream, #fdf6e3);
	}

	.verdict-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.ghost-btn {
		background: transparent;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		border-radius: 999px;
		padding: 0.5rem 1rem;
		color: var(--gold-bright, #f0c44a);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	.ghost-btn:hover:not(:disabled) {
		border-color: var(--gold, #c9a227);
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

	.other-modes {
		position: relative;
		z-index: 1;
		margin-top: 3rem;
		padding-top: 1.4rem;
		border-top: 1px solid rgba(201, 162, 39, 0.2);
	}

	.other-modes-title {
		margin: 0 0 0.8rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.74rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--gold, #c9a227);
	}

	.other-modes ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.other-modes a {
		display: inline-block;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		border: 1px solid rgba(201, 162, 39, 0.3);
		color: rgba(253, 246, 227, 0.75);
		text-decoration: none;
		font-size: 0.83rem;
		font-weight: 600;
		transition:
			color 0.2s ease,
			border-color 0.2s ease;
	}

	.other-modes a:hover,
	.other-modes a:focus-visible {
		color: var(--gold-bright, #f0c44a);
		border-color: var(--gold, #c9a227);
	}

	@media (max-width: 600px) {
		.page {
			padding: 1.6rem 1rem 4rem;
		}
	}
</style>
