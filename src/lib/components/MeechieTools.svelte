<!--
Purpose: Embed Meechie tools inside the main app flow.
Why: Keep non-technical users in one place while reusing seam-backed tools.
Info flow: User inputs -> MeechieToolSeam -> response output.
-->
<script lang="ts">
	import { postJson } from '$lib/core/http-client';
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
		margin-top: 2rem;
		position: relative;
		padding: 2rem;
		border-radius: 1.4rem;
		background: #16142a;
		border: 1px solid rgba(201, 162, 39, 0.35);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}

	.meechie::after {
		content: '';
		position: absolute;
		top: -40px;
		right: -20px;
		width: 200px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(232, 0, 106, 0.18), transparent 65%);
		pointer-events: none;
	}

	.hero h2 {
		font-size: clamp(1.6rem, 3vw, 2.1rem);
		margin: 0;
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-style: italic;
		font-weight: 800;
		color: var(--cream);
		font-family: 'Fraunces', 'Times New Roman', serif;
	}

	.subtitle {
		margin: 0.5rem 0 0;
		color: var(--lavender);
		font-size: 0.95rem;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.72rem;
		margin: 0 0 0.5rem;
		font-weight: 700;
		color: var(--gold);
	}

	.tool-picker,
	.form,
	.actions,
	.output {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
		z-index: 1;
	}

	.label {
		font-weight: 700;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--gold);
	}

	textarea,
	input,
	select {
		padding: 0.62rem 0.78rem;
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		font-size: 0.95rem;
		font-family: inherit;
		background: rgba(7, 7, 15, 0.65);
		color: var(--cream);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	textarea::placeholder,
	input::placeholder {
		color: rgba(184, 170, 207, 0.45);
	}

	select option {
		background: var(--dark-card-alt);
		color: var(--cream);
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--gold);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
	}

	.help {
		color: var(--lavender);
		font-size: 0.88rem;
		margin: 0;
	}

	.actions .primary {
		padding: 0.75rem 1.4rem;
		border-radius: 999px;
		border: none;
		background: linear-gradient(112deg, var(--fuchsia), #6b21a8 52%, var(--gold));
		color: #fff;
		font-weight: 800;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
	}

	.actions .primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 14px 28px rgba(232, 0, 106, 0.35);
		filter: saturate(1.1) brightness(1.05);
	}

	.actions .primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.lineup-items {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.lineup-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.lineup-row input {
		flex: 1;
	}

	.ghost {
		border: 1px solid var(--gold-border);
		background: transparent;
		padding: 0.38rem 0.72rem;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--gold-bright);
		transition: transform 0.2s ease, border-color 0.2s ease;
	}

	.ghost:hover {
		transform: translateY(-1px);
		border-color: var(--gold);
	}

	.error {
		color: #ff8ab3;
		font-weight: 700;
		background: rgba(232, 0, 106, 0.12);
		border-radius: 0.7rem;
		padding: 0.65rem 0.85rem;
		border: 1px solid rgba(232, 0, 106, 0.35);
	}

	.output {
		padding: 1.2rem;
		border-radius: 1rem;
		background: rgba(7, 7, 15, 0.7);
		border-left: 3px solid var(--fuchsia);
		border-top: 1px solid rgba(201, 162, 39, 0.2);
		border-right: 1px solid rgba(201, 162, 39, 0.2);
		border-bottom: 1px solid rgba(201, 162, 39, 0.2);
	}

	.output h3 {
		margin: 0 0 0.65rem;
		color: var(--gold-bright);
		font-family: 'Fraunces', 'Times New Roman', serif;
		font-style: italic;
		font-size: 1.2rem;
	}

	.output pre {
		white-space: pre-wrap;
		font-family: inherit;
		margin: 0;
		color: var(--cream);
		line-height: 1.5;
		font-size: 0.95rem;
	}

	@media (max-width: 680px) {
		.meechie {
			padding: 1.2rem;
			border-radius: 1rem;
		}

		.lineup-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
