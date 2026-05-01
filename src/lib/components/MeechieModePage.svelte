<!--
Purpose: Render a generic single-mode Meechie tool page that reuses one `/api/tools` pathway.
Why: Avoid duplicate per-route form/request logic while exposing focused mode experiences.
Info flow: Mode config + user inputs -> MeechieToolInputSchema -> /api/tools -> rendered tool output.
-->
<script lang="ts">
	import { postJson } from '$lib/core/http-client';
	import type { MeechieToolOutput } from '../../../contracts/meechie-tool.contract';
	import { MeechieToolInputSchema, MeechieToolResultSchema } from '../../../contracts/meechie-tool.contract';
	import type { ModeFieldId, ModeConfig } from './meechie-mode-config';

	export let config: ModeConfig;

	let output: MeechieToolOutput | null = null;
	let error = '';
	let isWorking = false;
	let fields: Record<ModeFieldId, string> = {
		situation: 'He said he was working late, but I saw him in the club.',
		excuse: "I was asleep and didn't hear my phone.",
		apology: "I'm sorry you feel that way.",
		moment: 'Late-night glam with no explanation.',
		claim: 'I never said that.',
		reality: 'Said it on Tuesday, Thursday, and in the group chat.',
		comment: "She said I'm doing too much.",
		dilemma: 'He disappeared for days then came back asking for loyalty.'
	};

	const handleGenerate = async (): Promise<void> => {
		output = null;
		error = '';
		isWorking = true;
		const candidate = config.buildInput(fields);
		const parsedInput = MeechieToolInputSchema.safeParse(candidate);
		if (!parsedInput.success) {
			error = 'Please complete the required field before generating.';
			isWorking = false;
			return;
		}

		try {
			const { payload } = await postJson('/api/tools', parsedInput.data);
			const parsedResult = MeechieToolResultSchema.safeParse(payload);
			if (!parsedResult.success) {
				error = 'Tool response did not match contract.';
				return;
			}
			if (parsedResult.data.ok) {
				output = parsedResult.data.value;
			} else {
				error = parsedResult.data.error.message;
			}
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Tool request failed.';
		} finally {
			isWorking = false;
		}
	};
</script>

<div class="mode-page">
	<header>
		<h1>{config.title}</h1>
		<p>{config.subhead}</p>
	</header>

	<section class="form">
		{#if config.fieldLabels.situation}
			<label for="situation">{config.fieldLabels.situation}</label>
			<textarea id="situation" bind:value={fields.situation} rows="3"></textarea>
		{/if}
		{#if config.fieldLabels.excuse}
			<label for="excuse">{config.fieldLabels.excuse}</label>
			<textarea id="excuse" bind:value={fields.excuse} rows="3"></textarea>
		{/if}
		{#if config.fieldLabels.apology}
			<label for="apology">{config.fieldLabels.apology}</label>
			<textarea id="apology" bind:value={fields.apology} rows="3"></textarea>
		{/if}
		{#if config.fieldLabels.moment}
			<label for="moment">{config.fieldLabels.moment}</label>
			<textarea id="moment" bind:value={fields.moment} rows="3"></textarea>
		{/if}
		{#if config.fieldLabels.claim}
			<label for="claim">{config.fieldLabels.claim}</label>
			<input id="claim" bind:value={fields.claim} />
		{/if}
		{#if config.fieldLabels.reality}
			<label for="reality">{config.fieldLabels.reality}</label>
			<input id="reality" bind:value={fields.reality} />
		{/if}
		{#if config.fieldLabels.comment}
			<label for="comment">{config.fieldLabels.comment}</label>
			<textarea id="comment" bind:value={fields.comment} rows="3"></textarea>
		{/if}
		{#if config.fieldLabels.dilemma}
			<label for="dilemma">{config.fieldLabels.dilemma}</label>
			<textarea id="dilemma" bind:value={fields.dilemma} rows="3"></textarea>
		{/if}
	</section>

	<button type="button" on:click={handleGenerate} disabled={isWorking}>
		{isWorking ? 'Working…' : config.button}
	</button>

	{#if error}
		<p class="error">{error}</p>
	{/if}
	{#if output}
		<section class="output">
			<h2>{output.headline}</h2>
			<pre>{output.response}</pre>
		</section>
	{/if}
</div>
