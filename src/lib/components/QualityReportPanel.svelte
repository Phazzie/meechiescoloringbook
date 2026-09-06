<!--
Purpose: The whole quality-report block as it appears under a "make the page" button — the clean
         line, or the boxed findings with their fixes.
Why: `VerdictPageStudio` and `MeechieTools` had byte-similar copies of this wrapper and of the
     `.drift` / `.drift-clean` / `.drift-title` rules behind it. Extracting `QualityFindings` alone
     left the box, its heading and ~30 lines of CSS duplicated in both — which SonarCloud measured
     and which is, more to the point, the same divergence risk this run is about: two copies is how
     one surface ends up rendering a state the other drops.
Info flow: A QualityReport in -> nothing (unchecked), a clean line, or the boxed findings.
Invariants: `unchecked` renders nothing here, deliberately. This block sits directly under the
            generate button, where "no check has reported" would caption an empty space the reader
            can already see. The home studio's always-open panel says it instead.
-->
<script lang="ts">
	import { describeQualityReport, type QualityReport } from '$lib/core/quality-report';
	import QualityFindings from './QualityFindings.svelte';

	let {
		report,
		cleanTestId,
		flaggedTestId,
		fixesTestId
	}: {
		report: QualityReport;
		cleanTestId?: string;
		flaggedTestId?: string;
		fixesTestId?: string;
	} = $props();
</script>

{#if report.state === 'clean'}
	<p class="drift-clean" data-testid={cleanTestId}>{describeQualityReport(report)}</p>
{:else if report.state === 'flagged'}
	<div class="drift" data-testid={flaggedTestId}>
		<p class="drift-title">{describeQualityReport(report)}</p>
		<QualityFindings findings={report.findings} fixes={report.fixes} {fixesTestId} />
	</div>
{/if}

<style>
	.drift {
		padding: 0.8rem 1rem;
		border-radius: 0.6rem;
		border: 1px solid rgba(201, 162, 39, 0.35);
		background: rgba(201, 162, 39, 0.08);
	}

	.drift-title {
		margin: 0 0 0.4rem;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold-bright, #f0c44a);
	}

	.drift-clean {
		margin: 0;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--emerald, #00c896);
	}
</style>
