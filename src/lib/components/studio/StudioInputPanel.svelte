<!--
Purpose: Evidence input, AI text action buttons, and draft-save feedback.
Why: Extracted from +page.svelte; parent owns all state and passes it down.
Info flow: User edits evidence/dedication → bind propagates up → callbacks trigger spec sync.
-->
<script lang="ts">
	import { getStudioAction, type StudioTextActionId, type StudioMode } from '$lib/core/meechie-studio';
	import type { DraftRestoreNotice } from '$lib/core/draft-restore';

	let {
		evidence = $bindable(),
		dedication = $bindable(),
		evidenceField = $bindable(null),
		activeMode,
		draftRestoreNotice,
		onDismissDraftRestoreNotice,
		revisionBudget,
		aiQuotaMessage,
		hasVerdict,
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
		/**
		 * What was restored from the autosaved draft, or `null` when this sitting started clean.
		 *
		 * The panel renders it and never decides it: whether the studio is showing the reader's own
		 * question is a fact about the draft, settled in `src/lib/core/draft-restore.ts`. All this
		 * component reads is `caution === null`, which is why it cannot put a warning tone on a
		 * restore that went right.
		 */
		draftRestoreNotice: DraftRestoreNotice | null;
		onDismissDraftRestoreNotice: () => void;
		/** Rewrites left for the verdict on screen. Meaningless until there is one — see `hasVerdict`. */
		revisionBudget: number;
		/** The server's own quota reading, already worded. Empty string when it has not reported one. */
		aiQuotaMessage: string;
		/** Whether a verdict is on the paper, which is what makes a rewrite count something to show. */
		hasVerdict: boolean;
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

	<!--
		Above the evidence box and below the heading, which is where it belongs: it is a statement
		about that heading and that box. `role="status"` rather than `alert` even when cautioning —
		nothing is broken and nothing is waiting on the reader, so it is announced politely at the
		next pause instead of interrupting them.
	-->
	{#if draftRestoreNotice}
		<div
			class="draft-restored"
			class:cautioned={draftRestoreNotice.caution !== null}
			role="status"
			data-testid="home-draft-restored"
		>
			<div class="draft-restored-text">
				<p class="draft-restored-headline">
					{draftRestoreNotice.headline}
					<span class="draft-restored-when">{draftRestoreNotice.savedLabel}</span>
				</p>
				{#if draftRestoreNotice.caution}
					<p class="draft-restored-caution" data-testid="home-draft-restored-caution">
						{draftRestoreNotice.caution}
					</p>
				{/if}
			</div>
			<button
				type="button"
				class="draft-restored-dismiss"
				data-testid="home-draft-restored-dismiss"
				onclick={onDismissDraftRestoreNotice}
				aria-label="Dismiss the restored draft notice"
			>
				×
			</button>
		</div>
	{/if}

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

	{#if draftSaveError}
		<p class="error" data-testid="home-draft-save-error">
			Draft not saved: {draftSaveError}
		</p>
	{/if}
	{#if textError}
		<p class="error" data-testid="home-text-error">{textError}</p>
	{/if}
</div>
