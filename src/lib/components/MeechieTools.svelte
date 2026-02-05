<!--
Purpose: Embed Meechie tools inside the main app flow.
Why: Keep non-technical users in one place while reusing seam-backed tools.
Info flow: User inputs -> MeechieToolSeam -> response output.
-->
<script lang="ts">
	import { meechieToolAdapter } from '$lib/adapters/meechie-tool.adapter';
	import type { MeechieToolInput, MeechieToolOutput } from '../../../contracts/meechie-tool.contract';
	import { HoroscopeSignSchema } from '../../../contracts/meechie-tool.contract';

	const tools = [
		{
			id: 'apology_translator',
			label: 'The Apology Translator',
			help: 'Decode a weak apology into what it really means.'
		},
		{
			id: 'red_flag_or_run',
			label: 'Red Flag or Run',
			help: 'Meechie decides if it is a red flag or a full run.'
		},
		{
			id: 'wwmd',
			label: 'What Would Meechie Do?',
			help: 'Get the game plan for your situation.'
		},
		{
			id: 'lineup',
			label: 'The Lineup',
			help: 'Rank a list of excuses or behaviors.'
		},
		{
			id: 'horoscope',
			label: "Meechie's Horoscope",
			help: 'Daily read for each sign, Meechie style.'
		},
		{
			id: 'receipts',
			label: 'The Receipts',
			help: 'Call out the contradiction with timestamps energy.'
		},
		{
			id: 'caption_this',
			label: 'Caption This',
			help: 'Turn a moment into a caption.'
		},
		{
			id: 'clapback',
			label: 'The Clapback Generator',
			help: 'Give Meechie the line, get the response.'
		},
		{
			id: 'meechie_explains',
			label: 'Meechie Explains It',
			help: 'Explain a term, Meechie style.'
		}
	] as const;

	const signs = HoroscopeSignSchema.options;
	type ToolId = (typeof tools)[number]['id'];

	let selectedTool: ToolId = tools[0].id;
	let output: MeechieToolOutput | null = null;
	let error = '';
	let isWorking = false;

	let apologyInput = "I'm sorry you feel that way";
	let situationInput = 'He said he is not ready for a relationship but wants to keep seeing me.';
	let dilemmaInput = "He left me on read for 3 days then texted 'hey stranger'.";
	let lineupPrompt = 'Rank these excuses:';
	let lineupItems: string[] = ['My phone died', 'I was with the guys', "I didn't see your text"];
	let horoscopeSign: (typeof signs)[number] = signs[0];
	let claimInput = 'I never said that';
	let realityInput = 'Said it Tuesday, Thursday, and twice on Saturday.';
	let momentInput = 'Post-breakup selfie looking good';
	let clapbackInput = "She said I'm doing a lot lately";
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
		const result = await meechieToolAdapter.respond(buildInput());
		if (result.ok) {
			output = result.value;
		} else {
			error = result.error.message;
		}
		isWorking = false;
	};
</script>

<section class="meechie">
	<header class="hero">
		<p class="eyebrow">Meechie Tools</p>
		<h2>Funny, sharp, and deterministic — every time.</h2>
		<p class="subtitle">Pick a tool, add your input, and let Meechie answer.</p>
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
			{isWorking ? 'Working…' : 'Get Meechie Answer'}
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
		padding: 32px;
		border-radius: 24px;
		background: #f6f1ea;
		border: 1px solid #eadfce;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.hero h2 {
		font-size: 2rem;
		margin: 0;
		line-height: 1.15;
	}

	.subtitle {
		margin: 8px 0 0;
		color: #5b4c3f;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.75rem;
		margin: 0 0 8px;
	}

	.tool-picker,
	.form,
	.actions,
	.output {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.label {
		font-weight: 600;
	}

	textarea,
	input,
	select {
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid #cfbba3;
		font-size: 0.95rem;
		font-family: inherit;
		background: #fffaf4;
		color: inherit;
	}

	.help {
		color: #6a5748;
		font-size: 0.9rem;
	}

	.actions .primary {
		padding: 12px 16px;
		border-radius: 999px;
		border: none;
		background: #1c1712;
		color: #fffaf4;
		font-weight: 600;
		cursor: pointer;
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
		border: 1px dashed #cfbba3;
		background: transparent;
		padding: 6px 10px;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.error {
		color: #a7352d;
		font-weight: 600;
	}

	.output {
		padding: 16px;
		border-radius: 16px;
		background: #fffaf4;
		border: 1px solid #eadfce;
	}

	.output pre {
		white-space: pre-wrap;
		font-family: inherit;
		margin: 0;
	}
</style>
