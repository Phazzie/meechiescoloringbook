<!--
Purpose: Collapsible diagnostics panel showing assembled prompt, model rewrite, and quality flags.
Why: Extracted from +page.svelte; read-only view of generation debug data.
Info flow: Parent passes all diagnostic values; no state or callbacks needed.
-->
<script lang="ts">
	import type { SpecValidationOutput } from '../../../../contracts/spec-validation.contract';
	import type { Violation } from '../../../../contracts/drift-detection.contract';

	let {
		assembledPrompt,
		revisedPrompt,
		validationIssues,
		violations
	}: {
		assembledPrompt: string;
		revisedPrompt: string;
		validationIssues: SpecValidationOutput['issues'];
		violations: Violation[];
	} = $props();
</script>

<details class="diagnostics">
	<summary>System Trace</summary>
	<div class="diagnostics-grid">
		<label>
			Prompt
			<textarea rows="6" readonly value={assembledPrompt}></textarea>
		</label>
		<label>
			Model Rewrite
			<textarea rows="6" readonly value={revisedPrompt}></textarea>
		</label>
		<div>
			<p class="eyebrow">Quality</p>
			{#if validationIssues.length === 0 && violations.length === 0}
				<p>No quality flags.</p>
			{:else}
				<ul>
					{#each validationIssues as issue}
						<li>{issue.field}: {issue.message}</li>
					{/each}
					{#each violations as violation}
						<li>{violation.code}: {violation.message}</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</details>
