<!--
Purpose: Developer-only debug panel showing the last system trace from generation.
Why: System trace data (prompts, violations, recommended fixes) is useful for debugging
     but meaningless to end users. Gated here so it stays invisible in the normal flow.
Info flow: localStorage 'meechie-debug-trace' -> read on mount -> displayed as read-only fields.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let assembledPrompt = '';
	let revisedPrompt = '';
	let violations: Array<{ code: string; message: string; severity: string }> = [];
	let recommendedFixes: Array<{ code: string; message: string }> = [];
	let loaded = false;
	let debugEnabled = false;

	onMount(() => {
		debugEnabled = $page.url.searchParams.has('debug');
		if (!debugEnabled) {
			return;
		}
		try {
			const raw = localStorage.getItem('meechie-debug-trace');
			if (raw) {
				const trace = JSON.parse(raw) as {
					assembledPrompt: string;
					revisedPrompt: string;
					violations: typeof violations;
					recommendedFixes: typeof recommendedFixes;
				};
				assembledPrompt = trace.assembledPrompt ?? '';
				revisedPrompt = trace.revisedPrompt ?? '';
				violations = trace.violations ?? [];
				recommendedFixes = trace.recommendedFixes ?? [];
			}
		} catch {
			// best-effort
		}
		loaded = true;
	});
</script>

<svelte:head>
	<title>Meechie Debug — System Trace</title>
</svelte:head>

<div class="debug-page">
	<header class="debug-header">
		<p class="eyebrow">Developer Only</p>
		<h1>System Trace</h1>
		<p class="subhead">
			This page is not linked from the main UI. Add <code>?debug=true</code> to view the last trace.
		</p>
		<a class="back-link" href="/">← Back to studio</a>
	</header>

	{#if !debugEnabled}
		<div class="gate">
			<p>Add <code>?debug=true</code> to the URL to view the system trace.</p>
			<a class="btn" href="/debug?debug=true">Enable debug view</a>
		</div>
	{:else if !loaded}
		<p class="loading">Loading trace…</p>
	{:else}
		<section class="trace-section">
			<h2>Assembled Prompt</h2>
			<textarea readonly rows="10" value={assembledPrompt} class="trace-area"></textarea>
		</section>

		<section class="trace-section">
			<h2>Model Rewrite</h2>
			<textarea readonly rows="5" value={revisedPrompt} class="trace-area"></textarea>
		</section>

		<section class="trace-section">
			<h2>Quality Flags</h2>
			{#if violations.length === 0}
				<p class="empty">No quality flags detected.</p>
			{:else}
				<ul class="trace-list">
					{#each violations as v}
						<li class="trace-item {v.severity}">
							<strong>{v.code}</strong>: {v.message}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="trace-section">
			<h2>Recommended Fixes</h2>
			{#if recommendedFixes.length === 0}
				<p class="empty">No fixes suggested.</p>
			{:else}
				<ul class="trace-list">
					{#each recommendedFixes as fix}
						<li class="trace-item">
							<strong>{fix.code}</strong>: {fix.message}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<style>
	.debug-page {
		max-width: 860px;
		margin: 0 auto;
		padding: 2rem 1.4rem 4rem;
		font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif;
		color: #fdf6e3;
	}

	.debug-header {
		margin-bottom: 2rem;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #c9a227;
		margin: 0 0 0.4rem;
	}

	h1 {
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-size: 2rem;
		font-style: italic;
		font-weight: 800;
		margin: 0 0 0.5rem;
	}

	.subhead {
		color: #b8aacf;
		font-size: 0.94rem;
		margin: 0 0 0.9rem;
	}

	code {
		background: rgba(201, 162, 39, 0.15);
		padding: 0.1rem 0.4rem;
		border-radius: 0.3rem;
		font-size: 0.88em;
		color: #f0c44a;
	}

	.back-link {
		color: #c9a227;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.gate {
		padding: 2rem;
		border-radius: 1rem;
		background: rgba(22, 20, 42, 0.8);
		border: 1px solid rgba(201, 162, 39, 0.35);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}

	.btn {
		padding: 0.6rem 1.2rem;
		border-radius: 999px;
		background: linear-gradient(112deg, #e8006a, #6b21a8 52%, #c9a227);
		color: #fff;
		font-weight: 700;
		font-size: 0.88rem;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.loading {
		color: #b8aacf;
		font-style: italic;
	}

	.trace-section {
		margin-bottom: 2rem;
		padding: 1.25rem;
		border-radius: 1rem;
		background: #16142a;
		border: 1px solid rgba(201, 162, 39, 0.25);
	}

	h2 {
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-style: italic;
		font-size: 1.2rem;
		font-weight: 700;
		color: #fdf6e3;
		margin: 0 0 0.75rem;
	}

	.trace-area {
		width: 100%;
		box-sizing: border-box;
		background: rgba(7, 7, 15, 0.7);
		border: 1px solid rgba(201, 162, 39, 0.2);
		border-radius: 0.7rem;
		padding: 0.7rem 0.8rem;
		font-family: 'Courier New', monospace;
		font-size: 0.82rem;
		color: #fdf6e3;
		resize: vertical;
	}

	.empty {
		color: #b8aacf;
		font-style: italic;
		margin: 0;
	}

	.trace-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.trace-item {
		font-size: 0.88rem;
		padding: 0.5rem 0.7rem;
		border-radius: 0.5rem;
		background: rgba(7, 7, 15, 0.5);
		border: 1px solid rgba(201, 162, 39, 0.15);
	}

	.trace-item.error {
		border-color: rgba(232, 0, 106, 0.4);
		color: #ff8ab3;
	}

	.trace-item.warning {
		border-color: rgba(240, 196, 74, 0.35);
		color: #f0c44a;
	}
</style>
