<!--
Purpose: The home studio's quality report — what the checks found about the page on the paper, the
         fixes they computed alongside, and the prompt trace behind both.
Why: This panel used to render `{code}: {message}` for every finding, show none of the recommended
     fixes the drift seam computes for nearly every violation, flatten a warning into an error, and
     print "No quality flags" for a studio that had never generated anything — the same sentence it
     printed for a page that had passed every check. It is the only surface that tells the reader
     whether the page matches what was asked for, so each of those was the panel saying more than it
     knew.
Info flow: Parent passes the report built by `buildQualityReport` plus the two prompts; this renders
           them. Read-only — no state, no callbacks.
-->
<script lang="ts">
	import {
		describeQualityReport,
		type QualityReport
	} from '$lib/core/quality-report';
	import QualityFindings from '../QualityFindings.svelte';

	let {
		assembledPrompt,
		revisedPrompt,
		promptWasSent,
		report
	}: {
		assembledPrompt: string;
		revisedPrompt: string;
		/**
		 * Whether `assembledPrompt` was actually sent to a provider.
		 *
		 * Not the same as "it is non-empty". The try-on flow writes a human description into
		 * `assembledPrompt` purely because a vault record requires a non-empty one, and no request
		 * is ever made — so treating any non-empty string as sent put that description under "What
		 * Was Sent" and reported "No rewrite reported" beneath it, implying a provider call.
		 */
		promptWasSent: boolean;
		report: QualityReport;
	} = $props();

	const headline = $derived(describeQualityReport(report));
	// The provider only returns a rewrite for some models and some requests, and an absent one is
	// not an empty one: an empty textarea labelled "Model Rewrite" reads as "the model rewrote your
	// prompt to nothing", which is the opposite of what happened.
	const hasRewrite = $derived(revisedPrompt.trim().length > 0);
	// Whether anything was sent at all. Without this the rewrite branch spoke about a prompt that
	// does not exist — on a freshly opened studio it sat directly under "No prompt sent yet" and
	// said the model had used it.
	const hasPrompt = $derived(promptWasSent && assembledPrompt.length > 0);
</script>

<details class="diagnostics">
	<summary>
		System Trace
		{#if report.state === 'flagged'}
			<span class="flag-count" data-testid="system-trace-flag-count">
				{report.findings.length}
			</span>
		{/if}
	</summary>

	<div class="trace-body">
		<section class="quality" data-testid="system-trace-quality" data-state={report.state}>
			<p class="eyebrow">The Check</p>

			{#if report.state === 'unchecked'}
				<p class="empty" data-testid="system-trace-unchecked">
					Nothing on the paper yet. Make a page and the check reports here.
				</p>
			{:else if report.state === 'not-applicable'}
				<!-- A wig try-on portrait is installed without a prompt, so no check is coming. Saying
				     "nothing on the paper yet" about it was false while the portrait was on screen. -->
				<p class="empty" data-testid="system-trace-not-applicable">{headline}</p>
			{:else if report.state === 'clean'}
				<p class="clean" data-testid="system-trace-clean">{headline}</p>
			{:else}
				<p class="headline" data-testid="system-trace-headline">{headline}</p>

				<QualityFindings
					findings={report.findings}
					fixes={report.fixes}
					fixesTestId="system-trace-fixes"
				/>
			{/if}
		</section>

		<section class="prompts">
			<p class="eyebrow">What Was Sent</p>
			{#if hasPrompt}
				<textarea rows="6" readonly value={assembledPrompt} aria-label="Prompt sent"></textarea>
			{:else}
				<p class="empty">No prompt sent yet.</p>
			{/if}

			<p class="eyebrow">What The Model Made Of It</p>
			{#if hasRewrite}
				<textarea rows="6" readonly value={revisedPrompt} aria-label="Model rewrite"></textarea>
			{:else if hasPrompt}
				<!-- "No rewrite reported", not "the model used the prompt as written". `revisedPrompt`
				     is an optional provider field: its absence means the provider did not report a
				     rewrite, which is not evidence that it used the prompt verbatim. -->
				<p class="empty">No rewrite reported.</p>
			{:else}
				<p class="empty">Nothing sent yet.</p>
			{/if}
		</section>
	</div>
</details>

<style>
	.flag-count {
		display: inline-block;
		margin-left: 0.4rem;
		min-width: 1.35rem;
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		background: rgba(232, 0, 106, 0.18);
		border: 1px solid rgba(232, 0, 106, 0.4);
		color: #ff8ab3;
		font-size: 0.74rem;
		font-weight: 800;
		text-align: center;
	}

	.trace-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		margin-top: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.45rem;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--gold);
	}


	.empty {
		margin: 0;
		color: var(--lavender);
		font-style: italic;
	}

	.clean {
		margin: 0;
		color: var(--emerald);
		font-weight: 700;
	}

	.headline {
		margin: 0 0 0.7rem;
		color: var(--cream);
		font-weight: 700;
	}











	.prompts textarea {
		width: 100%;
		box-sizing: border-box;
		margin-bottom: 0.9rem;
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		padding: 0.62rem 0.72rem;
		font-family: inherit;
		font-size: 0.86rem;
		color: var(--cream);
		background: rgba(7, 7, 15, 0.7);
		resize: vertical;
	}

	.prompts .empty {
		margin-bottom: 0.9rem;
	}

	@media (max-width: 900px) {
		.trace-body {
			grid-template-columns: 1fr;
		}
	}
</style>
