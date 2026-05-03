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
	<section class="tool-picker" aria-label="Select a tool">
		<p class="label">Choose your tool</p>
		<div class="tool-tabs" role="tablist">
			{#each tools as tool}
				<button
					role="tab"
					type="button"
					class="tool-tab"
					class:active={selectedTool === tool.id}
					aria-selected={selectedTool === tool.id}
					on:click={() => { selectedTool = tool.id; resetState(); }}
				>
					{tool.label}
				</button>
			{/each}
		</div>
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
			{#if isWorking}
				<span class="working-inner">
					<span class="working-dot" aria-hidden="true"></span>
					Reading the situation…
				</span>
			{:else}
				Get Meechie's Take
			{/if}
		</button>
	</section>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if output}
		<section class="output">
			<div class="verdict-badge" aria-hidden="true">
				<span class="verdict-label">Verdict</span>
				<span class="verdict-crown">♛</span>
			</div>
			<h3>{output.headline}</h3>
			<p class="verdict-body">{output.response}</p>
		</section>
	{/if}
</section>

<style>
	.meechie {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.8rem;
		padding: 2.2rem;
		border-radius: 1rem;
		background: var(--dark-card, #16142a);
		border: 1px solid rgba(201, 162, 39, 0.28);
		box-shadow: 0 24px 56px rgba(0, 0, 0, 0.55);
		overflow: hidden;
	}

	.meechie::before {
		content: '';
		position: absolute;
		top: -60px;
		right: -40px;
		width: 260px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(232, 0, 106, 0.14), transparent 65%);
		pointer-events: none;
	}

	/* Tool tabs */
	.tool-picker {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		position: relative;
		z-index: 1;
	}

	.tool-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.tool-tab {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.4rem 0.9rem;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.25);
		background: transparent;
		color: rgba(253, 246, 227, 0.55);
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}

	.tool-tab:hover {
		color: var(--cream, #fdf6e3);
		border-color: rgba(201, 162, 39, 0.5);
	}

	.tool-tab.active {
		background: rgba(232, 0, 106, 0.15);
		border-color: rgba(232, 0, 106, 0.6);
		color: var(--cream, #fdf6e3);
	}

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
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-weight: 700;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--gold, #c9a227);
		margin: 0;
	}

	textarea,
	input,
	select {
		padding: 0.65rem 0.8rem;
		border-radius: 4px;
		border: 1px solid rgba(201, 162, 39, 0.22);
		font-size: 0.95rem;
		font-family: inherit;
		background: rgba(7, 7, 15, 0.65);
		color: var(--cream, #fdf6e3);
		transition: border-color 0.18s ease, box-shadow 0.18s ease;
	}

	textarea::placeholder,
	input::placeholder {
		color: rgba(184, 170, 207, 0.4);
	}

	select option {
		background: #1c1932;
		color: #fdf6e3;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--gold, #c9a227);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.15);
	}

	.help {
		color: var(--lavender, #b8aacf);
		font-size: 0.87rem;
		margin: 0;
		font-style: italic;
	}

	/* Primary action */
	.actions .primary {
		align-self: flex-start;
		padding: 0.78rem 1.6rem;
		border-radius: 4px;
		border: none;
		background: linear-gradient(112deg, var(--fuchsia, #e8006a), #8b16c2 52%, var(--gold, #c9a227));
		color: #fff;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
	}

	.actions .primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 32px rgba(232, 0, 106, 0.38);
		filter: saturate(1.1) brightness(1.06);
	}

	.actions .primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.working-inner {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}

	.working-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fff;
		animation: pulse-dot 1.1s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.7); }
	}

	/* Lineup */
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
		border: 1px solid rgba(201, 162, 39, 0.3);
		background: transparent;
		padding: 0.38rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold-bright, #f0c44a);
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.ghost:hover {
		border-color: rgba(201, 162, 39, 0.6);
		background: rgba(201, 162, 39, 0.07);
	}

	.error {
		color: #ff8ab3;
		font-weight: 600;
		background: rgba(232, 0, 106, 0.1);
		border-radius: 4px;
		padding: 0.7rem 0.9rem;
		border: 1px solid rgba(232, 0, 106, 0.3);
		font-size: 0.9rem;
	}

	/* Verdict output */
	.output {
		padding: 1.6rem;
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.75);
		border: 1px solid rgba(201, 162, 39, 0.22);
		border-top: 3px solid var(--fuchsia, #e8006a);
		animation: verdict-in 0.35s ease;
	}

	@keyframes verdict-in {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.verdict-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	.verdict-label {
		font-family: var(--font-label, 'Barlow Condensed', sans-serif);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--fuchsia, #e8006a);
	}

	.verdict-crown {
		font-size: 0.85rem;
		color: var(--gold, #c9a227);
		filter: drop-shadow(0 0 6px rgba(201, 162, 39, 0.5));
	}

	.output h3 {
		margin: 0 0 0.9rem;
		color: var(--cream, #fdf6e3);
		font-family: var(--font-display, 'Fraunces', 'Times New Roman', serif);
		font-style: italic;
		font-size: clamp(1.25rem, 3vw, 1.65rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.verdict-body {
		margin: 0;
		color: rgba(253, 246, 227, 0.85);
		line-height: 1.65;
		font-size: 0.97rem;
		white-space: pre-wrap;
	}

	@media (max-width: 680px) {
		.meechie {
			padding: 1.4rem 1.1rem;
		}

		.tool-tabs {
			gap: 0.35rem;
		}

		.tool-tab {
			font-size: 0.76rem;
			padding: 0.38rem 0.72rem;
		}

		.lineup-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
