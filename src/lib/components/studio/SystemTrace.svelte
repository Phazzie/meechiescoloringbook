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

	let {
		assembledPrompt,
		revisedPrompt,
		report
	}: {
		assembledPrompt: string;
		revisedPrompt: string;
		report: QualityReport;
	} = $props();

	const headline = $derived(describeQualityReport(report));
	// The provider only returns a rewrite for some models and some requests, and an absent one is
	// not an empty one: an empty textarea labelled "Model Rewrite" reads as "the model rewrote your
	// prompt to nothing", which is the opposite of what happened.
	const hasRewrite = $derived(revisedPrompt.trim().length > 0);
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
			{:else if report.state === 'clean'}
				<p class="clean" data-testid="system-trace-clean">{headline}</p>
			{:else}
				<p class="headline" data-testid="system-trace-headline">{headline}</p>

				<ul class="findings">
					<!-- Deliberately unkeyed: `code` is not unique across findings — two lines can
					     breach the same rule — and a duplicate key is a runtime error in Svelte. -->
					{#each report.findings as finding}
						<li class={finding.weight} data-code={finding.code}>
							<span class="tag">
								{#if finding.weight === 'blocker'}Wrong{:else if finding.weight === 'note'}Noted{:else}Unchecked{/if}
							</span>
							<span class="finding-message">{finding.message}</span>
						</li>
					{/each}
				</ul>

				{#if report.fixes.length > 0}
					<div class="fixes" data-testid="system-trace-fixes">
						<p class="eyebrow">What Closes It</p>
						<!-- Listed as their own block rather than under the findings above. The seam
						     returns violations and fixes as two independent arrays and promises no
						     pairing between them, so putting a fix under a finding would be this
						     component inventing a link the contract never made. -->
						<ul>
							{#each report.fixes as fix}
								<li>{fix}</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/if}
		</section>

		<section class="prompts">
			<p class="eyebrow">What Was Sent</p>
			{#if assembledPrompt.length > 0}
				<textarea rows="6" readonly value={assembledPrompt} aria-label="Prompt sent"></textarea>
			{:else}
				<p class="empty">No prompt sent yet.</p>
			{/if}

			<p class="eyebrow">What The Model Made Of It</p>
			{#if hasRewrite}
				<textarea rows="6" readonly value={revisedPrompt} aria-label="Model rewrite"></textarea>
			{:else}
				<p class="empty">The model used the prompt as written.</p>
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

	.fixes .eyebrow {
		margin-top: 0.9rem;
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

	.findings {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.45rem;
	}

	.findings li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.55rem;
		align-items: baseline;
		padding: 0.5rem 0.6rem;
		border-radius: 0.6rem;
		background: rgba(7, 7, 15, 0.5);
		border: 1px solid rgba(201, 162, 39, 0.16);
	}

	.tag {
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.findings li.blocker {
		border-color: rgba(232, 0, 106, 0.35);
	}

	.findings li.blocker .tag {
		color: #ff8ab3;
	}

	.findings li.note .tag {
		color: var(--gold-bright);
	}

	.findings li.check-failed {
		border-color: rgba(184, 170, 207, 0.35);
	}

	.findings li.check-failed .tag {
		color: var(--lavender);
	}

	.finding-message {
		color: var(--cream);
		font-size: 0.9rem;
	}

	.fixes ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.3rem;
		color: var(--cream);
		font-size: 0.9rem;
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
