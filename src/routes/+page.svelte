<!--
Purpose: Main Meechie coloring-page studio with wig try-on.
Why: Generate AI-backed Meechie wording, printable coloring pages, and wig try-on portraits.
Info flow: User evidence -> MeechieStudioTextSeam -> page spec -> image/package/store seams.
           Wig selection + selfie -> /api/wig-try-on -> xAI portrait -> coloring page.
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

	const studio = new StudioState();

	onMount(async () => {
		await studio.init();
	});

	onDestroy(() => {
		studio.destroy();
	});
</script>

<svelte:head>
	<title>Meechie's Coloring Book Studio</title>
</svelte:head>

<main class="studio" data-testid="studio-root" data-hydrated={studio.isBrowser ? 'true' : 'false'}>
	<StudioHero
		weeklyModes={studio.weeklyModes}
		monthlyModeId={studio.monthlyModeId}
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
			activeMode={studio.activeMode}
			revisionBudget={studio.revisionBudget}
			textError={studio.textError}
			isTextWorking={studio.isTextWorking}
			draftSaveError={studio.draftSaveError}
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
			packagedFiles={studio.packagedFiles}
			generationError={studio.generationError}
			isGenerating={studio.isGenerating}
			textOutput={studio.textOutput}
			copyStatus={studio.copyStatus}
			vaultStatus={studio.vaultStatus}
			isSaving={studio.isSaving}
			glitter={studio.glitter}
			activeTheme={studio.activeTheme}
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
			onSettingChange={studio.syncSpecFromCurrentText}
		/>
	</section>

	<WigTryOnStudio
		selectedWigId={studio.selectedWigId}
		selectedWig={studio.selectedWig}
		tryOnPortraitUrl={studio.tryOnPortraitUrl}
		tryOnError={studio.tryOnError}
		isTryingOn={studio.isTryingOn}
		canTryOn={studio.canTryOn}
		isGenerating={studio.isGenerating}
		onWigSelect={studio.selectWigForTryOn}
		onSelfieUpload={studio.setSelfieForTryOn}
		onWigTryOn={studio.handleWigTryOn}
		onGenerateTryOnPage={studio.handleGenerateTryOnPage}
	/>

	<VerdictRow
		textOutput={studio.textOutput}
		vaultEntries={studio.vaultEntries}
		visibleVaultEntries={studio.visibleVaultEntries}
		hiddenVaultCount={studio.hiddenVaultCount}
		canToggleVaultShowAll={studio.canToggleVaultShowAll}
		totalSavedCount={studio.creations.length}
		vaultShowAll={studio.vaultShowAll}
		vaultQuery={studio.vaultQuery}
		vaultError={studio.vaultError}
		vaultReadFailed={studio.vaultReadFailed}
		pendingDeleteId={studio.pendingDeleteId}
		undoableDeletion={studio.undoableDeletion}
		onLoadCreation={studio.loadCreation}
		onRequestDelete={studio.requestDeleteCreation}
		onCancelDelete={studio.cancelDeleteCreation}
		onConfirmDelete={studio.deleteCreation}
		onUndoDelete={studio.undoDelete}
		onDismissUndo={studio.dismissUndoDelete}
		onToggleFavorite={studio.toggleFavorite}
		onVaultQueryChange={studio.setVaultQuery}
		onToggleShowAll={studio.toggleVaultShowAll}
	/>

	<SystemTrace
		assembledPrompt={studio.assembledPrompt}
		revisedPrompt={studio.revisedPrompt}
		validationIssues={studio.validationIssues}
		violations={studio.violations}
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

	:global(.studio .mode-strip) {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.65rem;
		margin: 1rem 0;
	}

	:global(.studio .mode-card) {
		min-height: 210px;
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
		animation-delay: calc(var(--card-index, 0) * 90ms);
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
	:global(.studio .vault-card),
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

	:global(.studio .budget) {
		margin: 0.2rem 0 0.9rem;
		padding: 0.7rem;
		border-radius: 6px;
		background: rgba(201, 162, 39, 0.09);
		color: var(--gold-bright);
		font-weight: 700;
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

	:global(.studio .vault-head) {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	:global(.studio .vault-count) {
		flex-shrink: 0;
		padding: 0.24rem 0.5rem;
		border: 1px solid rgba(201, 162, 39, 0.28);
		border-radius: 999px;
		color: var(--gold-bright);
		font-family: var(--font-label);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	/* Visible label rather than a placeholder-only field: the placeholder disappears the
	   moment anyone types, and a search box with no name is unreadable to a screen reader. */
	:global(.studio .vault-search-label) {
		display: block;
		font-size: 0.68rem;
	}

	:global(.studio input.vault-search) {
		margin: 0.3rem 0 0.75rem;
	}

	:global(.studio .vault-undo) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(201, 162, 39, 0.1);
		color: var(--cream);
		font-size: 0.84rem;
	}

	:global(.studio .vault-undo-actions) {
		display: flex;
		gap: 0.4rem;
	}

	:global(.studio .vault-list) {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Wraps rather than overflows: the vault card is narrow on a phone and narrow again in the
	   desktop two-column row, so the actions drop onto their own line instead of colliding
	   with the title. */
	:global(.studio .vault-item) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem 0.6rem;
		border-top: 1px solid rgba(201, 162, 39, 0.14);
		padding-top: 0.5rem;
	}

	:global(.studio .vault-item.pinned) {
		border-top-color: rgba(240, 196, 74, 0.5);
	}

	/* The whole row is the open target, so the click area matches what a reader would aim at.
	   It is a button, not a link: reopening a page mutates studio state, it does not navigate. */
	:global(.studio button.vault-open) {
		flex: 1 1 190px;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		padding: 0.35rem;
		border: 1px solid transparent;
		background: transparent;
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
	}

	:global(.studio button.vault-open:hover),
	:global(.studio button.vault-open:focus-visible) {
		border-color: rgba(201, 162, 39, 0.32);
		background: rgba(201, 162, 39, 0.08);
	}

	:global(.studio .vault-thumb) {
		flex-shrink: 0;
		width: 46px;
		height: 60px;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.28);
		background: rgba(253, 246, 227, 0.92);
		object-fit: cover;
	}

	:global(.studio .vault-thumb-empty) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(7, 7, 15, 0.62);
		color: var(--lavender);
		font-size: 0.9rem;
		font-weight: 800;
	}

	:global(.studio .vault-copy) {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	:global(.studio .vault-title) {
		color: var(--cream);
		font-family: var(--font-display);
		font-size: 0.98rem;
		font-style: italic;
		font-weight: 800;
		line-height: 1.2;
	}

	:global(.studio .vault-pin-mark) {
		margin-right: 0.28rem;
		color: var(--gold-bright);
	}

	/* One line each: the vault is a list you scan, not a place to read the page. */
	:global(.studio .vault-quote),
	:global(.studio .vault-meta) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--lavender);
	}

	:global(.studio .vault-quote) {
		font-size: 0.8rem;
	}

	:global(.studio .vault-meta) {
		font-size: 0.7rem;
		font-family: var(--font-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(.studio .vault-item-actions) {
		display: flex;
		flex: 0 1 auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.3rem;
	}

	:global(.studio .vault-item-actions button),
	:global(.studio .vault-item-actions .button-link),
	:global(.studio .vault-undo button) {
		min-height: 32px;
		padding: 0.32rem 0.55rem;
		font-size: 0.66rem;
	}

	:global(.studio .vault-item-actions button[aria-pressed='true']) {
		border-color: var(--gold-bright);
		background: rgba(201, 162, 39, 0.18);
	}

	:global(.studio .vault-item-actions .danger) {
		border-color: rgba(232, 0, 106, 0.5);
		background: rgba(232, 0, 106, 0.16);
		color: #ff8ab3;
	}

	:global(.studio .vault-card .link) {
		border-color: transparent;
		background: transparent;
		color: var(--lavender);
	}

	:global(.studio .vault-more) {
		width: 100%;
		margin-top: 0.6rem;
	}

	:global(.studio .vault-card .empty) {
		color: var(--lavender);
		font-style: italic;
	}

	:global(.studio .error) {
		margin: 0.7rem 0 0;
		color: #ff8ab3;
	}

	:global(.studio .status) {
		color: var(--emerald);
		font-weight: 700;
	}

	:global(.studio .diagnostics) {
		margin-top: 1rem;
	}

	:global(.studio .diagnostics summary) {
		cursor: pointer;
		color: var(--gold-bright);
		font-weight: 800;
	}

	:global(.studio .diagnostics-grid) {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-top: 1rem;
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

		/* A phone-width vault row reads top to bottom: the page, then what you can do to it. */
		:global(.studio .vault-item) {
			flex-direction: column;
			align-items: stretch;
		}

		/* The 190px basis is a minimum *width* in a row; in a column it would become a
		   190px-tall block of dead space above the buttons. */
		:global(.studio button.vault-open) {
			flex: 0 0 auto;
		}

		:global(.studio .vault-item-actions) {
			justify-content: flex-start;
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

		:global(.studio .mode-strip) {
			grid-template-columns: repeat(3, 1fr);
		}

		:global(.studio .mode-card) {
			min-height: 170px;
		}

		:global(.studio .verdict-row),
		:global(.studio .diagnostics-grid),
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

		:global(.studio .mode-strip) {
			grid-template-columns: repeat(3, minmax(0, 1fr));
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
