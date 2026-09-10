<!--
Purpose: The whole `/describe` surface — say what the page should be, read back what Meechie
         understood, then spend a generation on it and take the page away.
Why: The interpretation half of this app has existed since its first weeks (contract, mock,
     fixtures, probe, pipeline, a live billable endpoint and a browser adapter, all tested) and had
     no front door: nothing under `src/routes/**` or `src/lib/components/**` called any of it, so
     the app could be *chosen from* but never *told*. This is that front door, and it is the only
     surface in the app that shows the reader what was understood before charging for a picture.
Info flow: DescribePageState (props) -> user actions -> state methods -> reactive redraw.
Invariants:
  - The quality report is rendered ONLY through `QualityReportPanel`, the export row ONLY through
    `PageExportRow`, print ONLY through `PrintPageButton`, share ONLY through `SharePageButton` and
    the save line ONLY through `VaultStatusLine`. A private copy of any of them is exactly how the
    three mode routes came to render a warning identically to an error and drop two of the report's
    states; one renderer is the fix, a second one is the bug coming back.
  - The read-back is captioned with the words it came from. The message box stays editable after an
    interpretation lands, so without that caption the panel would appear to describe whatever is in
    the box right now.
-->
<script lang="ts">
	import type { DescribePageState } from './describe-page-state.svelte';
	import QualityReportPanel from './QualityReportPanel.svelte';
	import AiQuotaLine from './AiQuotaLine.svelte';
	import PageExportRow from './PageExportRow.svelte';
	import PrintPageButton from './PrintPageButton.svelte';
	import SharePageButton from './SharePageButton.svelte';
	import VaultStatusLine from './VaultStatusLine.svelte';
	import GenerationFailureNotice from './GenerationFailureNotice.svelte';
	import {
		DESCRIBE_EXAMPLES,
		DESCRIBE_MESSAGE_MAX_LENGTH,
		summariseReadback
	} from '$lib/core/describe-page';

	let { studio }: { studio: DescribePageState } = $props();

	const handleKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			void studio.interpret();
		}
	};
</script>

<div class="describe">
	<div class="ambient" aria-hidden="true"></div>

	<header class="hero">
		<p class="eyebrow">Say It Your Way</p>
		<h1>Describe the page</h1>
		<p class="subhead">
			Every other page in here comes from one of Meechie's questions. This one comes from yours.
			Tell her what the page should say and how it should look — she reads it back before a
			single line gets drawn.
		</p>
	</header>

	<section class="card input-card" aria-label="Describe your page">
		<label class="field-label" for="describe-message">What should the page say?</label>
		<textarea
			id="describe-message"
			data-testid="describe-message"
			rows="4"
			maxlength={DESCRIBE_MESSAGE_MAX_LENGTH}
			value={studio.message}
			oninput={(event) => studio.setMessage(event.currentTarget.value)}
			onkeydown={handleKeydown}
			placeholder={'A page that says "Ask me again when you have receipts", big letters, roses around the edge'}
		></textarea>

		<div class="field-foot">
			<p class="hint">Ctrl + Enter to send</p>
			<!-- Counted against the same limit the button enforces, so the field cannot look fine
			     while the button refuses. -->
			<p class="counter" data-testid="describe-counter">
				{studio.message.trim().length}/{DESCRIBE_MESSAGE_MAX_LENGTH}
			</p>
		</div>

		{#if studio.messageProblem}
			<p class="notice" data-testid="describe-message-problem">
				{studio.messageProblem}
			</p>
		{/if}

		<div class="examples">
			<p class="examples-title">Or start from one of these</p>
			<!-- Clickable suggestions, never pre-filled values. A field that ships full of invented
			     drama can never fail its own required check, and the button then returns a real
			     answer about a fiction the reader never wrote — the defect `mode-catalog.ts` had to
			     undo on all eight mode pages. -->
			<div class="example-chips">
				{#each DESCRIBE_EXAMPLES as example (example)}
					<button
						type="button"
						class="ghost chip"
						onclick={() => studio.useExample(example)}
					>
						{example}
					</button>
				{/each}
			</div>
		</div>

		<!-- The read-back half. Its retry re-asks the words that were sent, not whatever is in the
		     box now. -->
		<GenerationFailureNotice
			failure={studio.interpretFailure}
			onRetry={() => void studio.retryInterpret()}
			isBusy={studio.isInterpreting}
			testId="describe-interpret-error"
		/>

		<button
			type="button"
			class="cta"
			data-testid="describe-interpret"
			onclick={() => void studio.interpret()}
			disabled={!studio.canInterpret}
		>
			{studio.isInterpreting ? "She's reading it…" : 'Read it back to me'}
		</button>

		{#if studio.quotaMessage}
			<p class="quota" data-testid="describe-quota">{studio.quotaMessage}</p>
		{/if}
	</section>

	{#if studio.readback}
		<section class="card readback" data-testid="describe-readback">
			<div class="readback-head">
				<p class="eyebrow">What She Understood</p>
				<h2>{summariseReadback(studio.readback)}</h2>
				<!-- The words this reading came from, not the words in the box: the box stays
				     editable, and a panel that silently re-attributed itself to a newer sentence
				     would be describing a page nobody asked for. -->
				<p class="readback-source" data-testid="describe-readback-source">
					From: “{studio.interpretedFrom}”
				</p>
			</div>

			<div class="sheet-preview">
				<p class="sheet-title" data-testid="describe-readback-title">
					{studio.readback.title}
				</p>
				{#if studio.readback.lines.length > 0}
					<!-- In prompt order, not spec order: `footerItem` is drawn as the unnumbered second
					     line under the headline, so it is shown there and without a number. See
					     `ReadBackLine`. -->
					<ul class="sheet-lines" data-testid="describe-readback-lines">
						{#each studio.readback.lines as line (`${line.number ?? 'second'}-${line.label}`)}
							<li class:second-line={line.isSecondLine}>
								<span class="line-number">{line.number ?? ''}</span>
								<span class="line-label">{line.label}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="sheet-empty">Just the headline. Nothing else on the sheet.</p>
				{/if}
			</div>

			<ul class="facts" data-testid="describe-readback-facts">
				{#each studio.readback.facts as fact (fact)}
					<li>{fact}</li>
				{/each}
			</ul>

			{#if studio.readback.cautions.length > 0}
				<!-- Never a refusal. Every one of these describes a page this app will happily make;
				     they exist so a generation is bought knowingly. -->
				<div class="cautions" data-testid="describe-readback-cautions">
					{#each studio.readback.cautions as caution (caution)}
						<p>{caution}</p>
					{/each}
				</div>
			{/if}

			<GenerationFailureNotice
				failure={studio.failure}
				onRetry={() => void studio.retryPage()}
				isBusy={studio.isGenerating}
				testId="describe-generate-error"
			/>

			<button
				type="button"
				class="cta"
				data-testid="describe-generate"
				onclick={() => void studio.makePage()}
				aria-describedby={studio.pageQuotaMessage ? 'page-budget' : undefined}
				disabled={!studio.canMakePage}
			>
				{studio.isGenerating ? 'Drawing it…' : 'Make this page'}
			</button>
			<!-- The image bucket, priced at THIS interpretation's own `variations`. `/describe` is
			     the one surface that can ask for up to four pictures, and four pictures cost four of
			     the eight units a minute the bucket holds. -->
			<AiQuotaLine
				message={studio.pageQuotaMessage}
				testId="describe-page-quota"
				id="page-budget"
			/>
		</section>
	{/if}

	<QualityReportPanel
		report={studio.qualityReport}
		cleanTestId="describe-clean"
		flaggedTestId="describe-violations"
		fixesTestId="describe-fixes"
	/>

	{#if studio.imagePreviews.length > 0}
		<section class="card finished" data-testid="describe-page">
			<div class="preview-grid" data-testid="describe-preview">
				<!-- Unkeyed deliberately: two variations of one spec can render byte-identical.
				     Each finished picture is its own printed sheet, marked in place. -->
				{#each studio.imagePreviews as preview}
					<figure data-print-sheet>
						<img src={preview} alt="Meechie coloring page" />
					</figure>
				{/each}
			</div>

			<PageExportRow
				exports={studio.pageExports}
				attempts={studio.packageAttempts}
				onRebuild={() => studio.rebuildDownloads()}
				isRebuilding={studio.isRebuildingDownloads || studio.isGenerating}
				testIdPrefix="describe"
			/>

			<div class="page-actions">
				<button
					class="ghost"
					type="button"
					data-testid="describe-save-vault"
					onclick={() => studio.saveToVault()}
					disabled={!studio.canSaveToVault}
				>
					{studio.isSaving ? 'Saving…' : 'Save to the vault'}
				</button>
				<PrintPageButton
					sheetCount={studio.imagePreviews.length}
					pageTitle={studio.pageTitle}
					testId="describe-print"
				/>
				<SharePageButton
					exports={studio.pageExports}
					pageTitle={studio.pageTitle}
					quote={studio.pageHeadline}
					testId="describe-share"
				/>
			</div>
			<VaultStatusLine
				status={studio.vaultStatus}
				failure={studio.vaultSaveFailure}
				onRetry={studio.retrySaveToVault}
				isBusy={studio.isSaving}
				testId="describe-vault-status"
			/>
		</section>
	{/if}
</div>

<style>
	.describe {
		/* `clip` rather than `hidden`: `hidden` would make this a scroll container on both axes,
		   and the ambient blob overhangs the right edge by design. */
		overflow-x: clip;
		position: relative;
		max-width: 680px;
		margin: 0 auto;
		padding: 2.5rem 1.4rem 5rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.ambient {
		position: absolute;
		top: 3rem;
		right: -0.5rem;
		width: clamp(180px, 26vw, 340px);
		aspect-ratio: 1;
		border-radius: 36% 64% 54% 46%;
		background: linear-gradient(
			145deg,
			rgba(232, 0, 106, 0.26),
			rgba(107, 33, 168, 0.18)
		);
		filter: blur(9px);
		pointer-events: none;
		z-index: 0;
	}

	.hero,
	.card {
		position: relative;
		z-index: 1;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--gold, #c9a227);
	}

	h1 {
		margin: 0 0 0.6rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: clamp(2.1rem, 5vw, 3.1rem);
		font-style: italic;
		font-weight: 800;
		line-height: 0.98;
		letter-spacing: -0.03em;
		color: var(--cream, #fdf6e3);
	}

	h2 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: 1.45rem;
		font-style: italic;
		font-weight: 800;
		color: var(--cream, #fdf6e3);
	}

	.subhead {
		margin: 0;
		font-size: 0.98rem;
		line-height: 1.5;
		color: var(--lavender, #b8aacf);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.45rem;
		border-radius: 1.2rem;
		background: var(--dark-card, #16142a);
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
	}

	.input-card {
		background: linear-gradient(
			160deg,
			rgba(232, 0, 106, 0.08),
			rgba(22, 20, 42, 0.95)
		);
	}

	.field-label {
		font-weight: 700;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--gold, #c9a227);
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		padding: 0.72rem;
		font-size: 0.96rem;
		font-family: inherit;
		line-height: 1.45;
		color: var(--cream, #fdf6e3);
		background: rgba(7, 7, 15, 0.7);
		resize: vertical;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	textarea:focus {
		outline: none;
		border-color: var(--gold, #c9a227);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
	}

	textarea::placeholder {
		color: rgba(184, 170, 207, 0.65);
	}

	.field-foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		margin-top: -0.35rem;
	}

	.hint,
	.counter {
		margin: 0;
		font-size: 0.79rem;
		color: var(--lavender, #b8aacf);
	}

	.notice {
		margin: 0;
		font-size: 0.86rem;
		color: var(--gold-bright, #f0c44a);
	}

	.examples-title {
		margin: 0 0 0.5rem;
		font-size: 0.79rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 700;
		color: var(--lavender, #b8aacf);
	}

	.example-chips {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ghost {
		border-radius: 999px;
		padding: 0.52rem 0.96rem;
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		background: transparent;
		color: var(--gold-bright, #f0c44a);
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			border-color 0.2s ease;
	}

	.ghost:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: var(--gold, #c9a227);
	}

	.ghost:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.chip {
		text-align: left;
		font-size: 0.86rem;
		line-height: 1.35;
		border-radius: 0.8rem;
	}

	.cta {
		border: none;
		border-radius: 999px;
		padding: 0.8rem 1.4rem;
		background: linear-gradient(112deg, #e8006a, #6b21a8 52%, #c9a227);
		color: #fff;
		font-family: inherit;
		font-weight: 800;
		font-size: 0.95rem;
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
		box-shadow: 0 14px 28px rgba(232, 0, 106, 0.35);
		filter: saturate(1.1) brightness(1.05);
	}

	.cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.quota {
		margin: 0;
		font-size: 0.79rem;
		text-align: center;
		color: var(--lavender, #b8aacf);
	}


	.readback-source {
		margin: 0.35rem 0 0;
		font-size: 0.84rem;
		font-style: italic;
		color: var(--lavender, #b8aacf);
	}

	.sheet-preview {
		border-radius: 0.9rem;
		border: 1px dashed rgba(201, 162, 39, 0.3);
		background: rgba(7, 7, 15, 0.55);
		padding: 1.1rem;
	}

	.sheet-title {
		margin: 0 0 0.7rem;
		font-family: var(--font-display, 'Fraunces', serif);
		font-size: 1.3rem;
		font-style: italic;
		font-weight: 800;
		color: var(--cream, #fdf6e3);
	}

	.sheet-lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.sheet-lines li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		color: var(--cream, #fdf6e3);
		font-size: 0.95rem;
	}

	.sheet-lines li.second-line {
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.22);
		font-weight: 700;
	}

	.line-number {
		min-width: 1.9rem;
		font-weight: 800;
		color: var(--gold-bright, #f0c44a);
	}

	.sheet-empty {
		margin: 0;
		color: var(--lavender, #b8aacf);
		font-style: italic;
	}

	.facts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.facts li {
		font-size: 0.8rem;
		color: var(--lavender, #b8aacf);
		border: 1px solid rgba(201, 162, 39, 0.22);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
	}

	.cautions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-radius: 0.7rem;
		border: 1px solid rgba(201, 162, 39, 0.35);
		background: rgba(201, 162, 39, 0.08);
		padding: 0.7rem 0.85rem;
	}

	.cautions p {
		margin: 0;
		font-size: 0.86rem;
		color: var(--gold-bright, #f0c44a);
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.8rem;
	}

	.preview-grid figure {
		margin: 0;
		border-radius: 0.9rem;
		overflow: hidden;
		background: #fff;
	}

	.preview-grid img {
		display: block;
		width: 100%;
		height: auto;
	}

	.page-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
</style>
