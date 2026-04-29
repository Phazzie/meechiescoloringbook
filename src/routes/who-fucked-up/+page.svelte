<!--
Purpose: "Who Fucked Up?" mode — user describes situation, Meechie states what it really means.
Why: Let users get an instant Meechie read on any situation without building a spec manually.
Info flow: Situation input -> tools API (red_flag_or_run) -> verdict display -> generate coloring page.
-->
<script lang="ts">
	import { postJson } from '$lib/core/http-client';
	import type { MeechieToolOutput } from '../../../contracts/meechie-tool.contract';
	import type { GeneratedImage } from '../../../contracts/image-generation.contract';
	import type { PackagedFile } from '../../../contracts/output-packaging.contract';
	import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
	import { MeechieToolResultSchema } from '../../../contracts/meechie-tool.contract';
	import { GenerateResultSchema } from '../../../contracts/generate.contract';

	let situation = '';
	let verdict: MeechieToolOutput | null = null;
	let isWorking = false;
	let isGenerating = false;
	let error = '';
	let generateError = '';
	let imagePreviews: string[] = [];
	let packagedFiles: PackagedFile[] = [];
	let dedicatedTo = '';
	let showSparkle = false;

	const handleSubmit = async (): Promise<void> => {
		if (!situation.trim()) return;
		isWorking = true;
		error = '';
		verdict = null;
		imagePreviews = [];
		packagedFiles = [];

		try {
			const { payload } = await postJson('/api/tools', {
				toolId: 'red_flag_or_run',
				situation: situation.trim()
			});
			const parsed = MeechieToolResultSchema.safeParse(payload);
			if (!parsed.success || !parsed.data.ok) {
				error = parsed.success && !parsed.data.ok ? parsed.data.error.message : 'Something went wrong.';
			} else {
				verdict = parsed.data.value;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Network error. Try again.';
		} finally {
			isWorking = false;
		}
	};

	const handleKeydown = (e: KeyboardEvent): void => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			void handleSubmit();
		}
	};

	const handleGenerate = async (): Promise<void> => {
		if (!verdict) return;
		isGenerating = true;
		generateError = '';
		imagePreviews = [];
		packagedFiles = [];

		try {
			const saying = `${verdict.headline} — ${verdict.response}`;
			const { payload } = await postJson('/api/generate', {
				spec: {
					title: saying,
					listMode: 'title_only',
					items: [],
					dedication: dedicatedTo.trim() || undefined,
					alignment: 'center',
					numberAlignment: 'strict',
					listGutter: 'normal',
					whitespaceScale: 35,
					textSize: 'large',
					fontStyle: 'block',
					textStrokeWidth: 9,
					colorMode: 'black_and_white_only',
					decorations: 'dense',
					illustrations: 'simple',
					shading: 'none',
					border: 'decorative',
					borderThickness: 10,
					variations: 1,
					outputFormat: 'pdf',
					pageSize: 'US_Letter'
				},
				styleHint: 'crown, diamonds, roses with thorns, bold statement coloring page'
			});

			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success || !parsed.data.ok) {
				generateError =
					parsed.success && !parsed.data.ok ? parsed.data.error.message : 'Page generation failed.';
				return;
			}

			const images = parsed.data.value.images;
			imagePreviews = images
				.map((img: GeneratedImage): string | null => {
					if (img.format === 'svg' && img.encoding === 'utf8') {
						return `data:image/svg+xml;utf8,${encodeURIComponent(img.data)}`;
					}
					if (img.encoding === 'base64') {
						return `data:image/${img.format};base64,${img.data}`;
					}
					return null;
				})
				.filter((u): u is string => u !== null);

			const packResult = await outputPackagingAdapter.package({
				images,
				outputFormat: 'pdf',
				fileBaseName: `meechie-who-fucked-up-${Date.now()}`,
				pageSize: 'US_Letter',
				variants: ['print', 'square']
			});
			if (packResult.ok) {
				packagedFiles = packResult.value.files;
			} else {
				generateError = packResult.error.message;
			}
		} catch (e) {
			generateError = e instanceof Error ? e.message : 'Network error. Try again.';
		} finally {
			isGenerating = false;
		}
	};

	const reset = (): void => {
		situation = '';
		verdict = null;
		imagePreviews = [];
		packagedFiles = [];
		error = '';
		generateError = '';
		dedicatedTo = '';
	};
</script>

<svelte:head>
	<title>Who Fucked Up? — Meechie's Coloring Book</title>
</svelte:head>

<div class="page">
	<div class="ambient ambient-a" aria-hidden="true"></div>

	{#if !verdict}
		<header class="hero">
			<p class="eyebrow">Mode One</p>
			<h1>Who Fucked Up?</h1>
			<p class="subhead">Tell Meechie what happened. She'll tell you what it really means.</p>
		</header>

		<section class="input-card">
			<label for="situation" class="input-label">What did they do?</label>
			<textarea
				id="situation"
				bind:value={situation}
				on:keydown={handleKeydown}
				rows="5"
				placeholder="He said his phone died but I saw him active on Instagram at midnight..."
				aria-label="Describe the situation"
			></textarea>
			<p class="key-hint">Ctrl + Enter to submit</p>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button
				type="button"
				class="cta"
				on:click={handleSubmit}
				disabled={isWorking || !situation.trim()}
			>
				{isWorking ? "She's reading it..." : "She's listening. Go."}
			</button>
		</section>

	{:else}
		<header class="verdict-hero">
			<p class="eyebrow">Meechie's Observation</p>
			<div class="verdict-badge">{verdict.headline}</div>
			<p class="verdict-response">{verdict.response}</p>
			<button type="button" class="ghost-btn" on:click={reset}>← Different situation</button>
		</header>

		<section class="page-section">
			<h2>Generate the Coloring Page</h2>
			<p class="section-sub">The verdict becomes the page. Print it. Color it. Dedicate it.</p>

			<div class="field">
				<label for="dedicated" class="field-label">Dedicated to (optional)</label>
				<input
					id="dedicated"
					type="text"
					bind:value={dedicatedTo}
					maxlength="60"
					placeholder="He had time to learn."
				/>
			</div>

			<label class="sparkle-toggle">
				<input type="checkbox" bind:checked={showSparkle} />
				<span>Glitter preview overlay</span>
			</label>

			{#if generateError}
				<p class="error">{generateError}</p>
			{/if}

			<button
				type="button"
				class="cta"
				on:click={handleGenerate}
				disabled={isGenerating}
			>
				{isGenerating ? 'Printing the truth...' : 'Generate My Coloring Page'}
			</button>

			{#if imagePreviews.length > 0}
				<div class="preview-grid">
					{#each imagePreviews as preview}
						<figure class:sparkle={showSparkle}>
							<img src={preview} alt="Meechie coloring page" />
						</figure>
					{/each}
				</div>
			{/if}

			{#if packagedFiles.length > 0}
				<div class="downloads">
					<p class="download-label">Save & Share</p>
					{#each packagedFiles as file}
						<a
							class="download-link"
							href={`data:${file.mimeType};base64,${file.dataBase64}`}
							download={file.filename}
						>
							{file.filename}
						</a>
					{/each}
				</div>
			{/if}
		</section>
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
			radial-gradient(circle at 100% 60%, rgba(107, 33, 168, 0.18), transparent 45%);
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
		background: linear-gradient(145deg, rgba(232, 0, 106, 0.28), rgba(107, 33, 168, 0.15));
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
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
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
		transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
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

	.ghost-btn:hover {
		border-color: var(--gold);
	}

	/* Generate section */
	.page-section {
		position: relative;
		z-index: 1;
	}

	h2 {
		margin: 0 0 0.3rem;
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: 1.6rem;
		font-style: italic;
		font-weight: 800;
		color: var(--cream);
	}

	.section-sub {
		margin: 0 0 1.4rem;
		font-size: 0.9rem;
		color: var(--lavender);
	}

	.field {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold);
	}

	input[type='text'] {
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		padding: 0.65rem 0.8rem;
		font-size: 0.95rem;
		font-family: inherit;
		color: var(--cream);
		background: rgba(7, 7, 15, 0.7);
		transition: border-color 0.2s ease;
	}

	input[type='text']:focus {
		outline: none;
		border-color: var(--gold);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.15);
	}

	input[type='text']::placeholder {
		color: rgba(184, 170, 207, 0.4);
	}

	.sparkle-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1rem;
		font-size: 0.87rem;
		color: var(--lavender);
		cursor: pointer;
	}

	.error {
		padding: 0.7rem 1rem;
		border-radius: 0.6rem;
		background: rgba(232, 0, 106, 0.1);
		border: 1px solid rgba(232, 0, 106, 0.3);
		font-size: 0.88rem;
		color: #ff8fab;
	}

	.preview-grid {
		display: grid;
		gap: 1rem;
		margin-top: 1.6rem;
	}

	figure {
		margin: 0;
		border-radius: 0.8rem;
		overflow: hidden;
		border: 1px solid var(--gold-border);
	}

	figure img {
		display: block;
		width: 100%;
		height: auto;
	}

	figure.sparkle {
		position: relative;
	}

	figure.sparkle::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 20%, rgba(240, 196, 74, 0.25), transparent 55%),
			radial-gradient(ellipse at 80% 80%, rgba(232, 0, 106, 0.18), transparent 50%);
		pointer-events: none;
	}

	.downloads {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.download-label {
		margin: 0 0 0.2rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold);
	}

	.download-link {
		display: inline-flex;
		align-items: center;
		padding: 0.6rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--gold-border);
		background: rgba(201, 162, 39, 0.08);
		color: var(--gold-bright);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 600;
		transition: border-color 0.2s ease, background-color 0.2s ease;
	}

	.download-link:hover {
		border-color: var(--gold);
		background: rgba(201, 162, 39, 0.15);
	}

	@media (max-width: 600px) {
		.page {
			padding: 1.6rem 1rem 4rem;
		}
	}
</style>
