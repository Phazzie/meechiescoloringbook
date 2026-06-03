<!--
Purpose: Evidence input, AI text action buttons, and draft-save feedback.
Why: Extracted from +page.svelte; parent owns all state and passes it down.
Info flow: User edits evidence/dedication → bind propagates up → callbacks trigger spec sync.
-->
<script lang="ts">
	import { getStudioAction, type StudioTextActionId, type StudioMode } from '$lib/core/meechie-studio';

	let {
		evidence = $bindable(),
		dedication = $bindable(),
		activeMode,
		revisionBudget,
		textError,
		isTextWorking,
		draftSaveError,
		canGenerateText,
		canRegenerateText,
		canMakePrettier,
		canMakeMeaner,
		canMakeMoreSpecific,
		onRunTextAction,
		onScheduleDraftSave,
		onDedicationInput
	}: {
		evidence: string;
		dedication: string;
		activeMode: StudioMode;
		revisionBudget: number;
		textError: string;
		isTextWorking: boolean;
		draftSaveError: string;
		canGenerateText: boolean;
		canRegenerateText: boolean;
		canMakePrettier: boolean;
		canMakeMeaner: boolean;
		canMakeMoreSpecific: boolean;
		onRunTextAction: (_actionId: StudioTextActionId) => Promise<void>;
		onScheduleDraftSave: () => void;
		onDedicationInput: (_event: Event) => void;
	} = $props();
</script>

<div class="input-panel">
	<div class="panel-head">
		<p class="eyebrow">Evidence</p>
		<h2 data-testid="home-active-mode-heading">{activeMode.label}</h2>
		<p>{activeMode.help}</p>
	</div>

	<label for="evidence">What happened?</label>
	<textarea
		id="evidence"
		data-testid="home-evidence"
		rows="8"
		bind:value={evidence}
		oninput={onScheduleDraftSave}
		placeholder={activeMode.placeholder}
	></textarea>

	<label for="dedication">Shoutout</label>
	<input
		id="dedication"
		bind:value={dedication}
		oninput={onDedicationInput}
		maxlength="60"
		placeholder="Optional dedication"
	/>

	<div class="budget">
		<span>{revisionBudget} AI text actions left</span>
		{#if revisionBudget === 0}
			<p>
				You used the wording changes for this page. Export, copy, theme, and
				vault still work.
			</p>
		{/if}
	</div>

	<div class="ai-actions">
		<button
			type="button"
			class="primary"
			data-testid="home-generate-verdict"
			onclick={() => onRunTextAction('generate_text')}
			disabled={!canGenerateText}
		>
			{isTextWorking ? 'Reading...' : getStudioAction('generate_text').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('regenerate')}
			disabled={!canRegenerateText}
		>
			{getStudioAction('regenerate').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('make_prettier')}
			disabled={!canMakePrettier}
		>
			{getStudioAction('make_prettier').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('make_meaner')}
			disabled={!canMakeMeaner}
		>
			{getStudioAction('make_meaner').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('make_more_specific')}
			disabled={!canMakeMoreSpecific}
		>
			{getStudioAction('make_more_specific').label}
		</button>
	</div>

	{#if draftSaveError}
		<p class="error" data-testid="home-draft-save-error">
			Draft not saved: {draftSaveError}
		</p>
	{/if}
	{#if textError}
		<p class="error" data-testid="home-text-error">{textError}</p>
	{/if}
</div>
