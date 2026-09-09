<!--
Purpose: Main Meechie coloring-page studio with wig try-on.
Why: Generate AI-backed Meechie wording, printable coloring pages, and wig try-on portraits.
Info flow: User evidence -> MeechieStudioTextSeam -> page spec -> image/package/store seams.
           Wig selection + selfie -> /api/wig-try-on -> xAI portrait -> coloring page.
Invariants: `SystemTrace` receives `promptWasSent` from the state and must never be left to infer
            it from `assembledPrompt` being non-empty — the try-on flow fills that field with a
            description it never sent. Likewise `report` is passed whole: the panel switches on its
            state, so handing it loose arrays would put the "empty means clean" inference back in a
            component. `failureDetail` is `studio.traceFailureDetail` for the same reason: this
            studio holds three failures that can be live at once, and picking one of them here with
            a `??` chain named the stale one in half the orderings.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { StudioState } from './studio-state.svelte';
	import StudioHero from '$lib/components/studio/StudioHero.svelte';
	import StudioInputPanel from '$lib/components/studio/StudioInputPanel.svelte';
	import StudioPreviewPanel from '$lib/components/studio/StudioPreviewPanel.svelte';
	import StudioSettingsPanel from '$lib/components/studio/StudioSettingsPanel.svelte';
	import WigTryOnStudio from '$lib/components/studio/WigTryOnStudio.svelte';
	import VerdictRow from '$lib/components/studio/VerdictRow.svelte';
	import SystemTrace from '$lib/components/studio/SystemTrace.svelte';
	import { VAULT_REOPEN_PARAM } from '$lib/core/vault-page';

	let { data } = $props();

	const studio = new StudioState();

	onMount(async () => {
		await studio.init();
		// A reader arriving from `/vault`, which links here rather than trying to rebuild half a
		// studio around a list. Read here rather than in `StudioState`, following `/offline`: the
		// URL is a browser value, and the state class is where every rule is unit-tested.
		//
		// After `init()`, because the page can only be found in the list `init()` loads. The
		// parameter is deliberately left in the address bar afterwards — that makes the link a real
		// permalink to a saved page, so a refresh or a bookmark reopens the same one.
		const requested = new URL(globalThis.location.href).searchParams.get(VAULT_REOPEN_PARAM);
		if (requested) await studio.openSavedPage(requested);
	});

	onDestroy(() => {
		studio.destroy();
	});

	/**
	 * The evidence box, bound up out of `StudioInputPanel` so the verdict card can send the reader
	 * back to it. `null` until that panel has rendered.
	 */
	let evidenceField = $state<HTMLTextAreaElement | null>(null);

	/**
	 * Take the reader to the evidence box, from the verdict card's "give her more evidence".
	 *
	 * Here rather than in `VerdictRow`, which owns neither the field nor the panel it sits in, and
	 * rather than in `StudioState`, where every rule in this studio is unit-tested and a DOM handle
	 * has no business being.
	 */
	const focusEvidenceField = (): void => {
		const field = evidenceField;
		if (!field) return;
		// The reader asked to be taken somewhere, so the scroll is not decoration — but a reader who
		// has asked their system for less motion gets the jump instead of the glide.
		const wantsLessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		field.scrollIntoView({ block: 'center', behavior: wantsLessMotion ? 'auto' : 'smooth' });
		field.focus();
	};
</script>

<svelte:head>
	<title>Meechie's Coloring Book Studio</title>
</svelte:head>

<main class="studio" data-testid="studio-root" data-hydrated={studio.isBrowser ? 'true' : 'false'}>
	<StudioHero
		modes={studio.modes}
		spotlight={studio.spotlight}
		spotlightNote={studio.spotlightNote}
		activeModeId={studio.activeModeId}
		activeMode={studio.activeMode}
		isTextWorking={studio.isTextWorking}
		canGenerateText={studio.canGenerateText}
		onRunTextAction={studio.runTextAction}
		onModeSelect={studio.handleModeSelect}
	/>

	<section class="workbench">
		<StudioInputPanel
			bind:evidence={studio.evidence}
			bind:dedication={studio.dedication}
			bind:evidenceField
			activeMode={studio.activeMode}
			revisionBudget={studio.revisionBudget}
			aiQuotaMessage={studio.aiQuotaMessage}
			hasVerdict={!!studio.textOutput}
			textFailure={studio.textFailure}
			onRetryText={() => void studio.retryTextAction()}
			isTextWorking={studio.isTextWorking}
			draftSaveFailure={studio.draftSaveFailure}
			onRetryDraftSave={studio.retryDraftSave}
			canGenerateText={studio.canGenerateText}
			canRegenerateText={studio.canRegenerateText}
			canMakePrettier={studio.canMakePrettier}
			canMakeMeaner={studio.canMakeMeaner}
			canMakeMoreSpecific={studio.canMakeMoreSpecific}
			onRunTextAction={studio.runTextAction}
			onScheduleDraftSave={studio.scheduleDraftSave}
			onDedicationInput={studio.handleDedicationInput}
		/>

		<StudioPreviewPanel
			previewOutput={studio.previewOutput}
			imagePreviews={studio.imagePreviews}
			pageExports={studio.pageExports}
			exportError={studio.exportError}
			pageFailure={studio.pageFailure}
			onRetryPage={() => void studio.retryPage()}
			isGenerating={studio.isGenerating}
			textOutput={studio.textOutput}
			copyStatus={studio.copyStatus}
			vaultStatus={studio.vaultStatus}
			vaultSaveFailure={studio.vaultSaveFailure}
			onRetrySaveToVault={() => void studio.saveToVault()}
			isSaving={studio.isSaving}
			canSaveToVault={studio.canSaveToVault}
			glitter={studio.pageGlitter}
			activeTheme={studio.activeTheme}
			pageCaution={studio.verdictReport.pageCaution ?? ''}
			pageQuotaMessage={studio.pageQuotaMessage}
			pageQuotaExhausted={studio.pageQuotaExhausted}
			onGeneratePage={studio.handleGeneratePage}
			onCopyQuote={studio.copyQuote}
			onSaveToVault={studio.saveToVault}
		/>

		<StudioSettingsPanel
			bind:selectedThemeId={studio.selectedThemeId}
			bind:intensity={studio.voice.intensity}
			bind:rawness={studio.voice.rawness}
			bind:thirdPerson={studio.voice.thirdPerson}
			bind:pageSize={studio.pageSize}
			bind:border={studio.border}
			bind:glitter={studio.glitter}
			styleSelectionUnknown={studio.styleSelectionUnknown}
			settingsError={studio.settingsError}
			settingsIssues={studio.settingsIssues}
			onSettingChange={studio.syncSpecFromCurrentText}
		/>
	</section>

	<WigTryOnStudio
		selectedWigId={studio.selectedWigId}
		selectedWig={studio.selectedWig}
		wigs={data.wigs}
		wigCatalogError={data.wigCatalogError}
		tryOnPortraitUrl={studio.tryOnPortraitUrl}
		tryOnPortraits={studio.tryOnPortraits}
		canCompareTryOns={studio.canCompareTryOns}
		canGenerateTryOnPage={studio.canGenerateTryOnPage}
		tryOnFailure={studio.tryOnFailure}
		isTryingOn={studio.isTryingOn}
		canTryOn={studio.canTryOn}
		tryOnQuotaMessage={studio.tryOnQuotaMessage}
		isGenerating={studio.isGenerating}
		onWigSelect={studio.selectWigForTryOn}
		onSelfieUpload={studio.setSelfieForTryOn}
		onWigTryOn={studio.handleWigTryOn}
		onRetryTryOn={() => void studio.retryWigTryOn()}
		onGenerateTryOnPage={studio.handleGenerateTryOnPage}
	/>

	<VerdictRow
		report={studio.verdictReport}
		onAddEvidence={focusEvidenceField}
		vault={studio.vault}
		visibleVaultEntries={studio.visibleVaultEntries}
		hiddenVaultCount={studio.hiddenVaultCount}
		canToggleVaultShowAll={studio.canToggleVaultShowAll}
		vaultShowAll={studio.vaultShowAll}
		vaultCountLabel={studio.vaultCountLabel}
		onLoadCreation={studio.loadCreation}
		onToggleShowAll={studio.toggleVaultShowAll}
	/>

	<SystemTrace
		failureDetail={studio.traceFailureDetail}
		assembledPrompt={studio.assembledPrompt}
		revisedPrompt={studio.revisedPrompt}
		promptWasSent={studio.promptWasSent}
		report={studio.qualityReport}
	/>
</main>

<style>
	/* All rules use :global(.studio …) so they reach across the extracted sub-components,
	   which are rendered inside <main class="studio"> but compiled with their own scope hashes. */

	:global(.studio) {
		max-width: 1240px;
		margin: 0 auto;
		padding: 1.4rem;
		color: var(--cream);
	}

	:global(.studio .hero) {
		width: 100vw;
		min-height: clamp(420px, 46vw, 560px);
		display: grid;
		grid-template-columns: minmax(0, 0.44fr) minmax(0, 0.56fr);
		align-items: flex-end;
		box-sizing: border-box;
		margin-left: calc(50% - 50vw);
		margin-right: calc(50% - 50vw);
		padding: clamp(1.4rem, 4vw, 3rem)
			max(1.4rem, calc((100vw - 1240px) / 2 + 1.4rem));
		border-top: 1px solid rgba(201, 162, 39, 0.32);
		border-bottom: 1px solid rgba(201, 162, 39, 0.32);
		background-position:
			center,
			center,
			right center;
		background-size: cover, cover, cover;
		box-shadow: 0 24px 56px rgba(0, 0, 0, 0.48);
	}

	:global(.studio .hero-copy) {
		max-width: 520px;
		grid-column: 1;
	}

	/* The banner art already renders "Meechies Coloring Book" as neon type. A second
	   copy of the same words at 8vw sat directly on Meechie's face, so the page said
	   its own name twice and hid its subject to do it. The heading stays for semantics
	   and for the case where the image fails to load, at a size that lets her be the
	   thing you look at. */
	:global(.studio .hero h1) {
		font-size: clamp(1.9rem, 3.1vw, 2.9rem);
		max-width: 15ch;
		margin-bottom: 0.55rem;
	}

	:global(.studio .eyebrow),
	:global(.studio label),
	:global(.studio .mode-label),
	:global(.studio .theme-chip),
	:global(.studio button),
	:global(.studio .button-link) {
		font-family: var(--font-label);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	:global(.studio .eyebrow) {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		color: var(--gold);
	}

	:global(.studio h1),
	:global(.studio h2) {
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 800;
		line-height: 0.98;
		color: var(--cream);
	}

	:global(.studio h1) {
		margin: 0 0 0.8rem;
		font-size: clamp(3rem, 8vw, 6.5rem);
	}

	:global(.studio h2) {
		margin: 0 0 0.7rem;
		font-size: clamp(1.4rem, 3vw, 2rem);
	}

	:global(.studio p) {
		line-height: 1.55;
		color: var(--lavender);
	}

	@keyframes mode-card-in {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Four columns, not three and not `auto-fill`. Three was the *rendered mode count* written into
	   the stylesheet, which is why it had to change at all. `auto-fill` was tried and screenshotted:
	   at this container width it fits six, leaving the eight modes as a row of six and a row of two
	   beside a hole the width of four cards. Four is a layout choice about how many cards read well
	   in a row, and it is not coupled to the catalogue — a ninth mode wraps onto the next row with
	   no edit here, which is the property that actually mattered. */
	:global(.studio .mode-strip) {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.65rem;
		margin: 1rem 0;
	}

	:global(.studio .mode-card) {
		min-height: 190px;
		padding: 0.8rem;
		border: 1px solid rgba(201, 162, 39, 0.22);
		border-radius: 8px;
		color: var(--cream);
		background:
			linear-gradient(
					180deg,
					rgba(7, 7, 15, 0.06) 0%,
					rgba(7, 7, 15, 0.04) 40%,
					rgba(7, 7, 15, 0.68) 74%,
					rgba(7, 7, 15, 0.95) 100%
				),
			var(--mode-image);
		background-size: cover;
		background-position: 50% 26%;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		gap: 0.4rem;
		text-align: left;
		animation: mode-card-in 0.38s ease both;
		/* 45ms, not the 90ms this had while the strip was three cards long. The stagger is a per-card
		   delay, so eight cards at 90ms left the last one arriving 630ms after the first — a visible
		   wait on the page's most prominent element. At 45ms the whole strip is in under 400ms. */
		animation-delay: calc(var(--card-index, 0) * 45ms);
	}

	:global(.studio .mode-card.active),
	:global(.studio .mode-card:focus-visible) {
		outline: 2px solid var(--mode-color);
		outline-offset: 2px;
	}

	:global(.studio .mode-card.featured) {
		position: relative;
	}

	:global(.studio .mode-featured-badge) {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		font-size: 0.6rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		background: var(--mode-color);
		color: #07070f;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		line-height: 1.4;
	}

	/* The week badge is the quieter of the two on purpose: one mode is the month's and two are the
	   week's, so giving all three the same solid fill would make the monthly call-out the least
	   distinctive thing on a strip of eight. */
	:global(.studio .mode-featured-badge.week) {
		background: rgba(7, 7, 15, 0.78);
		color: var(--cream);
		border: 1px solid var(--mode-color);
	}

	:global(.studio .mode-schedule) {
		margin: -0.35rem 0 0.9rem;
		font-family: var(--font-label);
		font-size: 0.76rem;
		letter-spacing: 0.04em;
		color: rgba(253, 246, 227, 0.6);
	}

	:global(.studio .mode-icon) {
		width: 28px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--mode-color);
		color: #07070f;
		font-weight: 900;
	}

	:global(.studio .mode-help) {
		font-size: 0.74rem;
		line-height: 1.3;
		color: rgba(253, 246, 227, 0.74);
		text-transform: none;
		letter-spacing: 0;
	}

	:global(.studio .focused-mode-links) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: -0.25rem 0 1rem;
	}

	:global(.studio .focused-mode-links a) {
		border: 1px solid rgba(201, 162, 39, 0.28);
		border-radius: 8px;
		color: var(--gold-bright);
		background: rgba(7, 7, 15, 0.52);
		padding: 0.45rem 0.7rem;
		font-size: 0.76rem;
		font-weight: 900;
		text-transform: uppercase;
		text-decoration: none;
	}

	:global(.studio .focused-mode-links a:focus-visible),
	:global(.studio .focused-mode-links a:hover) {
		border-color: var(--gold-bright);
		background: rgba(201, 162, 39, 0.16);
	}

	:global(.studio .workbench) {
		display: grid;
		grid-template-columns: minmax(280px, 0.82fr) minmax(360px, 1.2fr) minmax(
				260px,
				0.78fr
			);
		gap: 1rem;
		align-items: start;
	}

	:global(.studio .input-panel),
	:global(.studio .preview-panel),
	:global(.studio .settings-panel),
	:global(.studio .verdict-card),
	:global(.studio .diagnostics) {
		border: 1px solid rgba(201, 162, 39, 0.24);
		border-radius: 8px;
		background: rgba(22, 20, 42, 0.92);
		padding: 1rem;
	}

	:global(.studio .settings-panel summary) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
		color: var(--gold-bright);
	}

	:global(.studio .settings-panel summary::-webkit-details-marker) {
		display: none;
	}

	:global(.studio .settings-panel summary strong) {
		display: block;
		margin-top: 0.15rem;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-style: italic;
		color: var(--cream);
		text-transform: none;
		letter-spacing: 0;
	}

	:global(.studio .settings-panel[open] summary) {
		margin-bottom: 1rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid rgba(201, 162, 39, 0.16);
	}

	:global(.studio .panel-head) {
		margin-bottom: 1rem;
	}

	:global(.studio textarea),
	:global(.studio input),
	:global(.studio select) {
		width: 100%;
		margin: 0.35rem 0 0.9rem;
		padding: 0.72rem 0.78rem;
		border-radius: 6px;
		border: 1px solid rgba(201, 162, 39, 0.24);
		background: rgba(7, 7, 15, 0.78);
		color: var(--cream);
		font: inherit;
	}

	:global(.studio textarea:focus),
	:global(.studio input:focus),
	:global(.studio select:focus) {
		outline: 2px solid rgba(240, 196, 74, 0.48);
		outline-offset: 1px;
	}

	/* Two readings stacked rather than run together: the rewrite allowance is the studio's own
	   rule, the quota line is the server's, and a reader who runs out of one should be able to see
	   at a glance that the other still has room. */
	:global(.studio .budget) {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin: 0.2rem 0 0.9rem;
		padding: 0.7rem;
		border-radius: 6px;
		background: rgba(201, 162, 39, 0.09);
		color: var(--gold-bright);
		font-weight: 700;
	}

	/* The server's number, deliberately quieter than the studio's own: it is the one the reader
	   can do nothing about except wait. */
	:global(.studio .budget .quota) {
		font-size: 0.84rem;
		font-weight: 600;
		opacity: 0.85;
	}

	:global(.studio .budget p) {
		margin: 0.3rem 0 0;
		font-size: 0.84rem;
	}

	:global(.studio .ai-actions),
	:global(.studio .preview-actions) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	:global(.studio button),
	:global(.studio .button-link) {
		min-height: 40px;
		padding: 0.58rem 0.82rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.58);
		color: var(--gold-bright);
		text-decoration: none;
		cursor: pointer;
		font-size: 0.78rem;
	}

	:global(.studio button:disabled) {
		opacity: 0.42;
		cursor: not-allowed;
	}

	:global(.studio .primary) {
		border: none;
		background: linear-gradient(112deg, #e8006a, #8b16c2 52%, #c9a227);
		color: #fff;
	}

	/* The export row's own rules moved into `PageExportRow.svelte` when that row became the shared
	   one. They lived here, as `:global(.studio .export-*)`, for as long as the row was this page's
	   alone — which is a large part of why it stayed this page's alone: the markup was reachable by
	   copying and the styling was not, so every copy of it on another surface rendered unstyled and
	   was rewritten into something plainer instead. */

	:global(.studio .preview-head) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}

	:global(.studio .preview-head img) {
		width: 88px;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid rgba(201, 162, 39, 0.28);
	}

	:global(.studio .paper) {
		margin: 1rem 0;
		aspect-ratio: 8.5 / 11;
		min-height: 420px;
		border-radius: 8px;
		background: #faf7ee;
		color: #111;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		overflow: hidden;
		position: relative;
	}

	:global(.studio .paper.glitter::after) {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				circle at 20% 18%,
				rgba(201, 162, 39, 0.28),
				transparent 18%
			),
			radial-gradient(
				circle at 82% 34%,
				rgba(232, 0, 106, 0.18),
				transparent 16%
			),
			radial-gradient(
				circle at 42% 78%,
				rgba(139, 22, 194, 0.16),
				transparent 18%
			);
		pointer-events: none;
	}

	:global(.studio .generated-image) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	:global(.studio .paper-empty) {
		width: 82%;
		text-align: center;
		border: 3px solid #111;
		padding: 1rem;
	}

	:global(.studio .demo-caption) {
		font-size: 0.75rem;
		opacity: 0.6;
		text-align: center;
		margin-top: 0.5rem;
	}

	:global(.studio .paper-title) {
		margin: 0 0 1rem;
		font-family: var(--font-label);
		font-size: clamp(1.5rem, 4vw, 2.4rem);
		font-weight: 800;
		color: #111;
		text-transform: uppercase;
	}

	:global(.studio .paper-empty ol) {
		margin: 0 auto 1rem;
		text-align: left;
		max-width: 320px;
		font-weight: 800;
	}

	:global(.studio .paper-quote) {
		margin: 0;
		color: #111;
		font-weight: 700;
	}

	:global(.studio .theme-grid) {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.45rem;
		margin-bottom: 1rem;
	}

	:global(.studio .settings-content) {
		display: block;
	}

	:global(.studio .theme-chip) {
		justify-content: flex-start;
		text-align: left;
	}

	:global(.studio .theme-chip.active) {
		background: rgba(201, 162, 39, 0.18);
		color: var(--cream);
	}

	:global(.studio .toggle) {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		color: var(--lavender);
	}

	:global(.studio .toggle input) {
		width: auto;
		margin: 0;
	}

	/* Wig Try-On Studio */
	:global(.studio .wig-studio) {
		margin: 1.5rem 0;
		padding: 1.25rem;
		border: 1px solid rgba(255, 20, 147, 0.28);
		border-radius: 8px;
		background: rgba(22, 20, 42, 0.92);
	}

	:global(.studio .wig-studio-head) {
		margin-bottom: 1rem;
	}

	:global(.studio .wig-studio-head h2) {
		background: linear-gradient(90deg, #ff1493, #8b16c2);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	:global(.studio .try-on-row) {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 1.5rem;
		margin-top: 1.25rem;
		align-items: start;
	}

	:global(.studio .try-on-controls) {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	:global(.studio .try-on-btn) {
		width: 100%;
	}

	:global(.studio .affiliate-link) {
		display: block;
		text-align: center;
		border-color: rgba(255, 20, 147, 0.4);
		color: #ff1493;
	}

	:global(.studio .affiliate-link:hover) {
		background: rgba(255, 20, 147, 0.1);
	}

	:global(.studio .try-on-result) {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	:global(.studio .try-on-portrait) {
		width: 100%;
		max-width: 420px;
		border-radius: 8px;
		border: 2px solid rgba(255, 20, 147, 0.3);
		box-shadow: 0 8px 32px rgba(255, 20, 147, 0.2);
	}

	:global(.studio .try-on-result-actions) {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	:global(.studio .try-on-compare) {
		margin-top: 1rem;
	}

	:global(.studio .compare-strip) {
		display: flex;
		gap: 0.6rem;
		overflow-x: auto;
		padding: 0.5rem 0 0.25rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(201, 162, 39, 0.4) transparent;
		-webkit-overflow-scrolling: touch;
	}

	:global(.studio .compare-item) {
		flex: 0 0 104px;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.32rem;
		border: 2px solid rgba(201, 162, 39, 0.24);
		border-radius: 8px;
		background: rgba(22, 20, 42, 0.9);
		color: inherit;
		cursor: pointer;
		min-height: auto;
		transition:
			border-color 0.16s,
			box-shadow 0.16s;
	}

	:global(.studio .compare-item:hover),
	:global(.studio .compare-item:focus-visible) {
		border-color: rgba(255, 20, 147, 0.6);
	}

	:global(.studio .compare-item.active) {
		border-color: #ff1493;
		box-shadow: 0 0 14px rgba(255, 20, 147, 0.4);
	}

	:global(.studio .compare-thumb) {
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 5px;
		display: block;
	}

	:global(.studio .compare-name) {
		font-family: var(--font-label, sans-serif);
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
		color: rgba(253, 246, 227, 0.78);
	}

	/* Verdict + Vault */
	:global(.studio .verdict-row) {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
		gap: 1rem;
		margin: 1rem 0;
	}

	:global(.studio .rating) {
		display: inline-flex;
		padding: 0.28rem 0.5rem;
		border-radius: 6px;
		background: rgba(232, 0, 106, 0.18);
		color: #ff8ab3;
		font-weight: 800;
	}

	/* The vault's own rules moved into `VaultGallery.svelte` when the vault became a place you can
	   go rather than a card on this page. They lived here, as `:global(.studio .vault-*)`, for
	   fourteen runs — which is a large part of why the vault never left this page: the markup was
	   reachable by copying and the styling was not. The same reason the export row's rules moved. */

	:global(.studio .error) {
		margin: 0.7rem 0 0;
		color: #ff8ab3;
	}

	/* `.status` moved into `VaultStatusLine.svelte` with the line it styles. The rule that was
	   here reached, by the end, only into that component — which styles itself — and a host
	   styling a component that owns its own look is the arrangement this whole change exists to
	   undo. The two `.status` spans left in the app (`VerdictPageStudio`, `MeechieTools`) are
	   copy-status lines outside `.studio`, each styled in its own file. */

	:global(.studio .diagnostics) {
		margin-top: 1rem;
	}

	:global(.studio .diagnostics summary) {
		cursor: pointer;
		color: var(--gold-bright);
		font-weight: 800;
	}

	@media (max-width: 1100px) {
		:global(.studio .workbench) {
			grid-template-columns: 1fr;
		}

		:global(.studio .settings-panel[open] .settings-content) {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.7rem 1rem;
		}

		:global(.studio .theme-grid),
		:global(.studio .toggle) {
			grid-column: 1 / -1;
		}

		:global(.studio .try-on-row) {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 700px) {
		:global(.studio) {
			padding: 0.9rem;
		}

		:global(.studio .hero) {
			min-height: 400px;
			grid-template-columns: minmax(0, 0.68fr) minmax(0, 0.32fr);
			padding-block: 1.2rem;
			background-position:
				center,
				center,
				62% center;
		}

		/* Two, not three: eight cards divide evenly by four and by two and by nothing else useful,
		   so any other count leaves the last row short beside a gap. */
		:global(.studio .mode-strip) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		:global(.studio .mode-card) {
			min-height: 170px;
		}

		:global(.studio .verdict-row),
		:global(.studio .settings-panel[open] .settings-content) {
			grid-template-columns: 1fr;
		}

		:global(.studio .paper) {
			min-height: 360px;
		}
	}

	@media (max-width: 480px) {
		/* This used to be a flat 82% black wash across the whole banner, which made the
		   text legible by erasing the subject. Phone gets the same treatment as desktop
		   instead: she reads in the upper half, the scrim ramps up only where the copy
		   actually sits, and the frame is nudged left so she is in shot at this width. */
		:global(.studio .hero) {
			grid-template-columns: 1fr;
			background-image:
				linear-gradient(
					180deg,
					rgba(7, 7, 15, 0.12) 0%,
					rgba(7, 7, 15, 0.06) 28%,
					rgba(7, 7, 15, 0.68) 58%,
					rgba(7, 7, 15, 0.95) 100%
				),
				url('/meechie/meechie-banner.png') !important;
			background-position: 8% center !important;
			background-size: cover !important;
			min-height: 420px;
		}

		/* Two across, not three. At this width a third column leaves each card too narrow for its
		   label to survive on one line, and the strip is eight cards deep now rather than three —
		   four short rows read better than three cramped ones. */
		:global(.studio .mode-strip) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		:global(.studio .mode-card) {
			min-height: 140px;
			padding: 0.6rem;
		}

		:global(.studio .mode-icon) {
			width: 22px;
			height: 22px;
			font-size: 0.7rem;
		}

		:global(.studio .mode-help) {
			display: none;
		}

		:global(.studio .try-on-row) {
			grid-template-columns: 1fr;
		}
	}
</style>
