<!--
Purpose: Evidence input, AI text action buttons, and draft-save feedback.
Why: Extracted from +page.svelte; parent owns all state and passes it down.
Info flow: User edits evidence/dedication → bind propagates up → callbacks trigger spec sync.
-->
<script lang="ts">
	import { getStudioAction, type StudioTextActionId, type StudioMode } from '$lib/core/meechie-studio';
	import GenerationFailureNotice from '$lib/components/GenerationFailureNotice.svelte';
	import type { GenerationFailure } from '$lib/core/generation-failure';
	import StorageFailureNotice from '$lib/components/StorageFailureNotice.svelte';
	import type { StorageFailure } from '$lib/core/storage-failure';

	let {
		evidence = $bindable(),
		dedication = $bindable(),
		evidenceField = $bindable(null),
		activeMode,
		revisionBudget,
		aiQuotaMessage,
		hasVerdict,
		textFailure,
		onRetryText,
		isTextWorking,
		draftSaveFailure,
		onRetryDraftSave,
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
		/**
		 * The evidence box itself, handed back so the verdict card's "give her more evidence" can put
		 * the cursor in it.
		 *
		 * A binding rather than a `getElementById` in the parent: the element's id is this
		 * component's business, and a lookup by that id in another file is a second copy of it that
		 * goes stale the first time it is renamed, silently — the button would simply stop working.
		 */
		evidenceField: HTMLTextAreaElement | null;
		activeMode: StudioMode;
		/** Rewrites left for the verdict on screen. Meaningless until there is one — see `hasVerdict`. */
		revisionBudget: number;
		/** The server's own quota reading, already worded. Empty string when it has not reported one. */
		aiQuotaMessage: string;
		/** Whether a verdict is on the paper, which is what makes a rewrite count something to show. */
		hasVerdict: boolean;
		textFailure: GenerationFailure | null;
		onRetryText: () => void;
		isTextWorking: boolean;
		draftSaveFailure: StorageFailure | null;
		onRetryDraftSave: () => void;
		canGenerateText: boolean;
		canRegenerateText: boolean;
		canMakePrettier: boolean;
		canMakeMeaner: boolean;
		canMakeMoreSpecific: boolean;
		onRunTextAction: (_actionId: StudioTextActionId) => Promise<void>;
		onScheduleDraftSave: () => void;
		onDedicationInput: (value: string) => void;
	} = $props();

	const handleDedicationValue = (event: globalThis.Event): void => {
		const nextValue =
			event.currentTarget instanceof globalThis.HTMLInputElement
				? event.currentTarget.value
				: dedication;
		onDedicationInput(nextValue);
	};
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
		bind:this={evidenceField}
		bind:value={evidence}
		oninput={onScheduleDraftSave}
		placeholder={activeMode.placeholder}
	></textarea>

	<label for="dedication">Shoutout</label>
	<input
		id="dedication"
		bind:value={dedication}
		oninput={handleDedicationValue}
		maxlength="60"
		placeholder="Optional dedication"
	/>

	<!--
		Two numbers, both real, kept apart on purpose: what the server will let this caller spend,
		and how many rewrites of the verdict on screen are left. The panel used to show one invented
		number instead — a per-tab counter that called the first verdict a revision, never refilled,
		and described itself as being "for this page".
	-->
	<div class="budget" id="ai-budget" aria-live="polite">
		{#if hasVerdict}
			<span data-testid="home-rewrites-left">
				{revisionBudget} rewrite{revisionBudget === 1 ? '' : 's'} left for this verdict
			</span>
		{:else}
			<span data-testid="home-rewrites-left">Rewrites unlock once Meechie has ruled.</span>
		{/if}

		{#if aiQuotaMessage}
			<span class="quota" data-testid="home-ai-quota">{aiQuotaMessage}</span>
		{/if}

		{#if hasVerdict && revisionBudget === 0}
			<p data-testid="home-rewrites-spent">
				You have used every rewrite for this verdict. Generate a new one — change the
				evidence first if the facts changed — for a fresh set. Export, copy, theme, and
				vault never counted against it.
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
			aria-describedby="ai-budget"
		>
			{isTextWorking ? 'Reading...' : getStudioAction('generate_text').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('regenerate')}
			disabled={!canRegenerateText}
			aria-describedby="ai-budget"
		>
			{getStudioAction('regenerate').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('make_prettier')}
			disabled={!canMakePrettier}
			aria-describedby="ai-budget"
		>
			{getStudioAction('make_prettier').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('make_meaner')}
			disabled={!canMakeMeaner}
			aria-describedby="ai-budget"
		>
			{getStudioAction('make_meaner').label}
		</button>
		<button
			type="button"
			onclick={() => onRunTextAction('make_more_specific')}
			disabled={!canMakeMoreSpecific}
			aria-describedby="ai-budget"
		>
			{getStudioAction('make_more_specific').label}
		</button>
	</div>

	<!-- Was `Draft not saved: {draftSaveError}` — the seam's message, or a caught exception's, under
	     a label. The classified sentence already says the draft did not save and what it costs, so
	     the prefix is gone with the raw string it was introducing. -->
	<StorageFailureNotice
		failure={draftSaveFailure}
		operation="draft"
		onRetry={onRetryDraftSave}
		testId="home-draft-save-error"
	/>
	<GenerationFailureNotice
		failure={textFailure}
		onRetry={onRetryText}
		isBusy={isTextWorking}
		testId="home-text-error"
	/>
</div>
