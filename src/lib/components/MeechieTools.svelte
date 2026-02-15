<!--
Purpose: Embed Meechie tools inside the main app flow.
Why: Keep non-technical users in one place while reusing seam-backed tools.
Info flow: User inputs -> MeechieToolSeam -> response output.
-->
<script lang="ts">
	import { loadStoredApiKey, postJson } from '$lib/core/http-client';
	import type { MeechieToolInput, MeechieToolOutput } from '../../../contracts/meechie-tool.contract';
	import {
		HoroscopeSignSchema,
		MeechieToolInputSchema,
		MeechieToolResultSchema
	} from '../../../contracts/meechie-tool.contract';

	const tools = [
		{
			id: 'apology_translator',
			label: 'Apology Autopsy',
			help: 'Drop the apology. Get what it really meant.'
		},
		{
			id: 'red_flag_or_run',
			label: 'Run Or Red Flag',
			help: 'Quick verdict with no soft landing.'
		},
		{
			id: 'wwmd',
			label: 'Meechie Move',
			help: 'One move. Clear consequence.'
		},
		{
			id: 'lineup',
			label: 'Excuse Court',
			help: 'Rank excuses from weak to embarrassing.'
		},
		{
			id: 'horoscope',
			label: 'Meechie Forecast',
			help: 'Sign read with pressure and polish.'
		},
		{
			id: 'receipts',
			label: 'Receipt Check',
			help: 'Claim versus reality, line by line.'
		},
		{
			id: 'caption_this',
			label: 'Caption Drop',
			help: 'Turn the moment into a statement line.'
		},
		{
			id: 'clapback',
			label: 'Return Fire',
			help: 'Their line in, your line out.'
		},
		{
			id: 'meechie_explains',
			label: 'Term Breakdown',
			help: 'Street glossary in plain language.'
		}
	] as const;

	const signs = HoroscopeSignSchema.options;
	type ToolId = (typeof tools)[number]['id'];

	let selectedTool: ToolId = tools[0].id;
	let output: MeechieToolOutput | null = null;
	let error = '';
	let isWorking = false;

	let apologyInput = "I'm sorry you feel that way.";
	let situationInput = 'He said he was working late, but I saw him in the club.';
	let dilemmaInput = 'He went silent for days, then came back like I owe him a reply.';
	let lineupPrompt = 'Rank these excuses:';
	let lineupItems: string[] = ['My phone died', 'I was with the guys', "I didn't see your text"];
	let horoscopeSign: (typeof signs)[number] = signs[0];
	let claimInput = 'I never said that.';
	let realityInput = 'Said it Tuesday, Thursday, and in the group chat on Saturday.';
	let momentInput = 'Diamond nails, city lights, and no explanations';
	let clapbackInput = "She said I'm doing too much.";
	let explainsInput = 'Situationship';

	const resetState = (): void => {
		error = '';
		output = null;
	};

	const addLineupItem = (): void => {
		if (lineupItems.length >= 6) {
			return;
		}
		lineupItems = [...lineupItems, ''];
	};

	const removeLineupItem = (index: number): void => {
		if (lineupItems.length <= 1) {
			return;
		}
		lineupItems = lineupItems.filter((_, idx) => idx !== index);
	};

	const updateLineupItem = (index: number, value: string): void => {
		lineupItems = lineupItems.map((item, idx) => (idx === index ? value : item));
	};

	const buildInput = (): MeechieToolInput => {
		switch (selectedTool) {
			case 'apology_translator':
				return { toolId: selectedTool, apology: apologyInput };
			case 'red_flag_or_run':
				return { toolId: selectedTool, situation: situationInput };
			case 'wwmd':
				return { toolId: selectedTool, dilemma: dilemmaInput };
			case 'lineup':
				return { toolId: selectedTool, prompt: lineupPrompt, items: lineupItems };
			case 'horoscope':
				return { toolId: selectedTool, sign: horoscopeSign };
			case 'receipts':
				return { toolId: selectedTool, claim: claimInput, reality: realityInput };
			case 'caption_this':
				return { toolId: selectedTool, moment: momentInput };
			case 'clapback':
				return { toolId: selectedTool, comment: clapbackInput };
			default:
				return { toolId: selectedTool, term: explainsInput };
		}
	};

	const handleGenerate = async (): Promise<void> => {
		resetState();
		isWorking = true;
		const parsedInput = MeechieToolInputSchema.safeParse(buildInput());
		if (!parsedInput.success) {
			error = 'Please complete the required fields before generating.';
			isWorking = false;
			return;
		}

		try {
			const { payload } = await postJson('/api/tools', parsedInput.data, loadStoredApiKey());
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

<section class="meechie">
	<header class="hero">
		<p class="eyebrow">Meechie Tools</p>
		<h2>Power as fact. Consequences on record.</h2>
		<p class="subtitle">Name what happened. Meechie names the cost.</p>
	</header>

	<section class="tool-picker">
		<label class="label" for="tool-select">Tool</label>
		<select id="tool-select" bind:value={selectedTool} on:change={resetState}>
			{#each tools as tool}
				<option value={tool.id}>{tool.label}</option>
			{/each}
		</select>
		<p class="help">{tools.find((tool) => tool.id === selectedTool)?.help}</p>
	</section>

	<section class="form">
		{#if selectedTool === 'apology_translator'}
			<label class="label" for="apology">Apology received</label>
			<textarea id="apology" bind:value={apologyInput} rows="3"></textarea>
		{:else if selectedTool === 'red_flag_or_run'}
			<label class="label" for="situation">Situation</label>
			<textarea id="situation" bind:value={situationInput} rows="3"></textarea>
		{:else if selectedTool === 'wwmd'}
			<label class="label" for="dilemma">Dilemma</label>
			<textarea id="dilemma" bind:value={dilemmaInput} rows="3"></textarea>
		{:else if selectedTool === 'lineup'}
			<label class="label" for="lineup-prompt">Prompt</label>
			<input id="lineup-prompt" bind:value={lineupPrompt} />
			<div class="lineup-items">
				{#each lineupItems as item, index}
					<div class="lineup-row">
						<input
							value={item}
							on:input={(event) => updateLineupItem(index, (event.target as HTMLInputElement).value)}
						/>
						<button class="ghost" type="button" on:click={() => removeLineupItem(index)}>
							Remove
						</button>
					</div>
				{/each}
				<button class="ghost" type="button" on:click={addLineupItem}>Add item</button>
			</div>
		{:else if selectedTool === 'horoscope'}
			<label class="label" for="sign">Sign</label>
			<select id="sign" bind:value={horoscopeSign}>
				{#each signs as sign}
					<option value={sign}>{sign}</option>
				{/each}
			</select>
		{:else if selectedTool === 'receipts'}
			<label class="label" for="claim">Claim</label>
			<input id="claim" bind:value={claimInput} />
			<label class="label" for="reality">Reality</label>
			<input id="reality" bind:value={realityInput} />
		{:else if selectedTool === 'caption_this'}
			<label class="label" for="moment">Moment</label>
			<textarea id="moment" bind:value={momentInput} rows="2"></textarea>
		{:else if selectedTool === 'clapback'}
			<label class="label" for="comment">What they said</label>
			<textarea id="comment" bind:value={clapbackInput} rows="2"></textarea>
		{:else}
			<label class="label" for="term">Term</label>
			<input id="term" bind:value={explainsInput} />
		{/if}
	</section>

	<section class="actions">
		<button class="primary" type="button" on:click={handleGenerate} disabled={isWorking}>
			{isWorking ? 'Working…' : 'Get Meechie Move'}
		</button>
	</section>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if output}
		<section class="output">
			<h3>{output.headline}</h3>
			<pre>{output.response}</pre>
		</section>
	{/if}
</section>

<style>
	.meechie {
		margin-top: 48px;
		position: relative;
		padding: 32px;
		border-radius: 24px;
		background:
			linear-gradient(165deg, rgba(18, 26, 41, 0.94), rgba(24, 32, 52, 0.94)),
			#0f1726;
		border: 1px solid rgba(206, 163, 94, 0.26);
		display: flex;
		flex-direction: column;
		gap: 24px;
		box-shadow: 0 20px 36px rgba(16, 22, 35, 0.32);
		overflow: hidden;
	}

	.meechie::after {
		content: '';
		position: absolute;
		top: -40px;
		right: -20px;
		width: 180px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(224, 173, 96, 0.24), transparent 65%);
		pointer-events: none;
	}

	.hero h2 {
		font-size: clamp(1.6rem, 3vw, 2.1rem);
		margin: 0;
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: #f5f7fc;
		font-family: 'Fraunces', 'Times New Roman', serif;
	}

	.subtitle {
		margin: 8px 0 0;
		color: #c4ccdc;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-size: 0.72rem;
		margin: 0 0 8px;
		font-weight: 700;
		color: #d8b273;
	}

	.tool-picker,
	.form,
	.actions,
	.output {
		display: flex;
		flex-direction: column;
		gap: 12px;
		position: relative;
		z-index: 1;
	}

	.label {
		font-weight: 700;
		color: #e8edf7;
	}

	textarea,
	input,
	select {
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid rgba(112, 131, 167, 0.34);
		font-size: 0.95rem;
		font-family: inherit;
		background: rgba(255, 255, 255, 0.92);
		color: #1d2638;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: #d39d55;
		box-shadow: 0 0 0 3px rgba(211, 157, 85, 0.2);
	}

	.help {
		color: #b5bfce;
		font-size: 0.9rem;
	}

	.actions .primary {
		padding: 12px 16px;
		border-radius: 999px;
		border: none;
		background: linear-gradient(112deg, #314f86, #dd4f92 56%, #dfaa59);
		color: #fffaf2;
		font-weight: 700;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.actions .primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 18px rgba(49, 79, 134, 0.32);
	}

	.actions .primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.lineup-items {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.lineup-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.lineup-row input {
		flex: 1;
	}

	.ghost {
		border: 1px solid rgba(141, 161, 194, 0.42);
		background: rgba(35, 47, 71, 0.76);
		padding: 6px 10px;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.85rem;
		color: #e6edf9;
		transition: transform 0.2s ease;
	}

	.ghost:hover {
		transform: translateY(-1px);
	}

	.error {
		color: #7e233f;
		font-weight: 700;
		background: rgba(255, 214, 228, 0.86);
		border-radius: 10px;
		padding: 10px 12px;
		border: 1px solid rgba(205, 86, 132, 0.42);
	}

	.output {
		padding: 16px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(103, 121, 153, 0.24);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
	}

	.output h3 {
		margin-top: 0;
		color: #1e2740;
		font-family: 'Fraunces', 'Times New Roman', serif;
	}

	.output pre {
		white-space: pre-wrap;
		font-family: inherit;
		margin: 0;
		color: #3a465e;
		line-height: 1.45;
	}

	@media (max-width: 680px) {
		.meechie {
			padding: 20px;
			border-radius: 18px;
		}

		.lineup-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
