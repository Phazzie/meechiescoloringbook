<!--
Purpose: Render a flagged quality report — the findings with their severity tags, and the fixes the
         drift seam computed — for every surface that shows one.
Why: The home studio, the mode routes and the tools hub each grew their own copy of this markup, and
     the tag logic (which weight and source render as which word) was written three times. Three
     copies is how the surfaces diverged in the first place: before this run they disagreed about
     whether a warning looked different from an error and whether a remedy was shown at all. One
     component means a later change to what a finding looks like cannot land on two surfaces out of
     three.
Info flow: A `flagged` QualityReport in -> findings list + fixes list out. Presentational only.
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
	 * `check-failed` is tested before severity because an unfinished check is not a severity at all —
	 * it says nothing about the prompt either way. `settings` before the fallback because a spec
	 * problem is about the request on screen, not about what the prompt dropped.
	 */
	const tagFor = (finding: QualityFinding): string => {
		if (finding.weight === 'check-failed') return 'Unchecked';
		if (finding.weight === 'note') return 'Noted';
		return finding.source === 'settings' ? 'Setting' : 'Dropped';
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

	.findings li.check-failed .tag {
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
