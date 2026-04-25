<!--
Purpose: "Random Meechie" mode — one tap, one truth, instant coloring page.
Why: Give users zero-friction access to Meechie's voice with no input required, so a coloring page can be produced from a single interaction.
Info flow: Tap -> tools API (random_meechie) -> saying display -> generate coloring page.
-->
<script lang="ts">
	import { postJson } from '$lib/core/http-client';
	import type { MeechieToolOutput } from '../../../contracts/meechie-tool.contract';
	import type { GeneratedImage } from '../../../contracts/image-generation.contract';
	import type { PackagedFile } from '../../../contracts/output-packaging.contract';
	import { outputPackagingAdapter } from '$lib/adapters/output-packaging.adapter';
	import { MeechieToolResultSchema } from '../../../contracts/meechie-tool.contract';
	import { GenerateResultSchema } from '../../../contracts/generate.contract';

	let result: MeechieToolOutput | null = null;
	let isWorking = false;
	let isGenerating = false;
	let error = '';
	let generateError = '';
	let imagePreviews: string[] = [];
	let packagedFiles: PackagedFile[] = [];
	let dedicatedTo = '';
	let showSparkle = false;

	const handleTap = async (): Promise<void> => {
		isWorking = true;
		error = '';
		result = null;
		imagePreviews = [];
		packagedFiles = [];

		try {
			const { payload } = await postJson('/api/tools', {
				toolId: 'random_meechie'
			});
			const parsed = MeechieToolResultSchema.safeParse(payload);
			if (!parsed.success || !parsed.data.ok) {
				error = parsed.success && !parsed.data.ok ? parsed.data.error.message : 'Something went wrong.';
			} else {
				result = parsed.data.value;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Network error. Try again.';
		} finally {
			isWorking = false;
		}
	};

	const handleGenerate = async (): Promise<void> => {
		if (!result) return;
		isGenerating = true;
		generateError = '';
		imagePreviews = [];
		packagedFiles = [];

		try {
			const { payload } = await postJson('/api/generate', {
				spec: {
					title: result.response,
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
				styleHint: 'crown, sparkles, diamonds, roses, bold statement coloring page for women'
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
				fileBaseName: `meechie-random-${Date.now()}`,
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

	const another = (): void => {
		result = null;
		imagePreviews = [];
		packagedFiles = [];
		error = '';
		generateError = '';
		dedicatedTo = '';
		void handleTap();
	};
</script>

<svelte:head>
	<title>Random Meechie — Meechie's Coloring Book</title>
</svelte:head>

<div class="page">
	<div class="ambient ambient-a" aria-hidden="true"></div>
	<div class="ambient ambient-b" aria-hidden="true"></div>

	{#if !result && !isWorking}
		<header class="hero">
			<p class="crown" aria-hidden="true">✦</p>
			<h1>Random Meechie</h1>
			<p class="subhead">One tap. One truth. No context required.</p>
		</header>

		<div class="tap-zone">
			{#if error}
				<p class="error">{error}</p>
			{/if}
			<button type="button" class="tap-cta" on:click={handleTap} aria-label="Get a Meechie saying">
				Tap For Truth
			</button>
			<p class="tap-hint">No explanation needed. She already knows.</p>
		</div>

	{:else if isWorking}
		<div class="loading-zone" aria-live="polite" aria-busy="true">
			<p class="loading-crown" aria-hidden="true">♛</p>
			<p class="loading-text">She's deciding what you need to hear...</p>
		</div>

	{:else if result}
		<header class="saying-hero">
			<p class="eyebrow">Meechie Says</p>
			<blockquote class="saying">{result.headline}</blockquote>
			<div class="saying-actions">
				<button type="button" class="ghost-btn" on:click={another}>
					Another one
				</button>
			</div>
		</header>

		<section class="page-section">
			<h2>Generate the Coloring Page</h2>
			<p class="section-sub">Print it. Color it. Send it to whoever needs to see it.</p>

			<div class="field">
				<label for="dedicated" class="field-label">Dedicated to (optional)</label>
				<input
					id="dedicated"
					type="text"
					bind:value={dedicatedTo}
					maxlength="60"
					placeholder="He had time to know better."
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
			radial-gradient(circle at 50% 0%, rgba(107, 33, 168, 0.22), transparent 48%),
			radial-gradient(circle at 10% 80%, rgba(232, 0, 106, 0.14), transparent 45%),
			linear-gradient(180deg, #07070f, #0d0b1a 60%, #070710);
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
		background: linear-gradient(145deg, rgba(107, 33, 168, 0.28), rgba(232, 0, 106, 0.14));
	}

	.ambient-b {
		bottom: 8rem;
		right: -2rem;
		width: clamp(120px, 18vw, 230px);
		aspect-ratio: 1;
		border-radius: 54% 46% 44% 56%;
		background: linear-gradient(145deg, rgba(201, 162, 39, 0.2), rgba(107, 33, 168, 0.12));
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
		transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
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
		0%, 100% { opacity: 1; }
		50% { opacity: 0.45; }
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

	.cta {
		width: 100%;
		border: none;
		border-radius: 999px;
		padding: 1rem 1.6rem;
		background: linear-gradient(112deg, #6b21a8, #e8006a 55%, #c9a227);
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
		box-shadow: 0 16px 36px rgba(107, 33, 168, 0.4);
		filter: saturate(1.1) brightness(1.05);
	}

	.cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
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
			radial-gradient(ellipse at 80% 80%, rgba(107, 33, 168, 0.2), transparent 50%);
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

		.tap-cta {
			padding: 1rem 2rem;
			font-size: 1.05rem;
		}
	}
</style>
