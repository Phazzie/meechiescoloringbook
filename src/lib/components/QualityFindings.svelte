<!--
Purpose: Render a flagged quality report — the findings with their severity tags, and the fixes the
         drift seam computed — for every surface that shows one.
Why: The home studio, the mode routes and the tools hub each grew their own copy of this markup, and
     the tag logic (which weight and source render as which word) was written three times. Three
     copies is how the surfaces diverged in the first place: before this run they disagreed about
     whether a warning looked different from an error and whether a remedy was shown at all. One
     component means a later change to what a finding looks like cannot land on two surfaces out of
     three.
Info flow: A `flagged` QualityReport's findings and fixes in -> tagged list + fixes list out.
           Presentational only: no state, no callbacks, no transforms.
Invariants: The fixes are rendered as their own list and are NEVER paired with a finding — not by
            index, not by code. `DriftDetectionOutputSchema` declares two independent arrays and
            guarantees no ordering, no equal length and no shared key: the codes differ by design
            (`MISSING_PAGE_SIZE` against `ADD_PAGE_SIZE`), and two violation branches append one
            entry per offending line. Index pairing is right *usually*, which is exactly the danger
            — it would render a remedy under a finding it does not answer, silently and only
            sometimes. A future renderer must not infer a relationship the contract never made.
            The tag words are likewise scoped to what the check establishes: `Off-spec`, not
            `Dropped`, because the adapter also flags tokens that are present.
-->
<script lang="ts">
	import type { QualityFinding } from '$lib/core/quality-report';

	let {
		findings,
		fixes,
		findingsTestId,
		fixesTestId
	}: {
		findings: QualityFinding[];
		fixes: string[];
		findingsTestId?: string;
		fixesTestId?: string;
	} = $props();

	/**
	 * The word shown against a finding.
	 *
	 * The two unknown-state weights are tested before severity because neither is a severity: an
	 * unfinished check and an unrecorded result each say nothing about the prompt either way, and
	 * they are kept apart from each other because a missing record cannot tell them apart. `settings`
	 * before the fallback because a spec problem is about the request on screen rather than the
	 * prompt.
	 */
	const tagFor = (finding: QualityFinding): string => {
		if (finding.weight === 'check-failed') return 'Unchecked';
		if (finding.weight === 'unrecorded') return 'Unrecorded';
		if (finding.weight === 'note') return 'Noted';
		// "Off-spec", not "Dropped": the adapter emits `FORBIDDEN_TOKEN` for a token that is
		// *present*, so a tag meaning "missing" contradicted the sentence beside it.
		return finding.source === 'settings' ? 'Setting' : 'Off-spec';
	};
</script>

<ul class="findings" data-testid={findingsTestId}>
	<!-- Deliberately unkeyed: `code` is not unique across findings — two lines can breach the same
	     rule — and a duplicate key is a runtime error in Svelte. -->
	{#each findings as finding}
		<li class={finding.weight} data-code={finding.code} data-source={finding.source}>
			<span class="tag">{tagFor(finding)}</span>
			<span class="finding-message">{finding.message}</span>
		</li>
	{/each}
</ul>

{#if fixes.length > 0}
	<!-- Their own list, not annotations on the findings above. The drift seam returns violations and
	     fixes as two independent arrays and promises no pairing between them, so rendering a fix
	     under a finding would assert a link the contract never made. -->
	<p class="fixes-title">What closes it</p>
	<ul class="fixes" data-testid={fixesTestId}>
		{#each fixes as fix}
			<li>{fix}</li>
		{/each}
	</ul>
{/if}

<style>
	.findings {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.4rem;
	}

	.findings li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.55rem;
		align-items: baseline;
		line-height: 1.5;
	}

	.tag {
		font-size: 0.67rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.findings li.blocker .tag {
		color: #ff8fab;
	}

	.findings li.note .tag {
		color: var(--gold-bright, #f0c44a);
	}

	.findings li.check-failed .tag,
	.findings li.unrecorded .tag {
		color: var(--lavender, #b8aacf);
	}

	.finding-message {
		color: var(--cream, #fdf6e3);
		font-size: 0.88rem;
	}

	.fixes-title {
		margin: 0.75rem 0 0.35rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--gold, #c9a227);
	}

	.fixes {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.3rem;
		color: var(--cream, #fdf6e3);
		font-size: 0.88rem;
	}
</style>
