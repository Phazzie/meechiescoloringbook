<!--
Purpose: Theme picker, voice controls, page-size/border/glitter settings.
Why: Extracted from +page.svelte; uses $bindable props so changes propagate to parent state.
Info flow: User picks a setting → bind syncs to parent → onSettingChange triggers spec rebuild.
-->
<script lang="ts">
	import { studioThemes } from '$lib/core/meechie-studio';
	import type { ColoringPageSpec } from '../../../../contracts/spec-validation.contract';

	type PageSize = ColoringPageSpec['pageSize'];
	type BorderChoice = ColoringPageSpec['border'];

	let {
		selectedThemeId = $bindable(),
		intensity = $bindable(),
		rawness = $bindable(),
		thirdPerson = $bindable(),
		pageSize = $bindable(),
		border = $bindable(),
		glitter = $bindable(),
		onSettingChange
	}: {
		selectedThemeId: string;
		intensity: 'receipts_out' | 'church_lady' | 'no_mercy';
		rawness: 'mild' | 'medium' | 'raw';
		thirdPerson: 'sometimes' | 'always' | 'never';
		pageSize: PageSize;
		border: BorderChoice;
		glitter: boolean;
		// The source is passed, not inferred. A theme chip fires this handler even when the reader
		// clicks the chip that is already active, so comparing theme IDs cannot tell "the reader
		// picked a theme" from "some other control changed" — and on a reopened page, whose real
		// theme was never recorded, the comparison gets it wrong in both directions.
		onSettingChange: (source: 'theme' | 'setting') => Promise<void>;
	} = $props();
</script>

<details class="settings-panel">
	<summary>
		<span>
			<span class="eyebrow">Settings</span>
			<strong>Page Controls</strong>
		</span>
		<span aria-hidden="true">Open</span>
	</summary>

	<div class="settings-content">
		<div class="theme-grid" aria-label="Theme options">
			{#each studioThemes as theme}
				<button
					type="button"
					class="theme-chip"
					class:active={selectedThemeId === theme.id}
					onclick={async () => {
						selectedThemeId = theme.id;
						await onSettingChange('theme');
					}}
				>
					<span>{theme.icon}</span>
					{theme.label}
				</button>
			{/each}
		</div>

		<label for="intensity">Intensity</label>
		<select
			id="intensity"
			bind:value={intensity}
			onchange={() => onSettingChange('setting')}
		>
			<option value="receipts_out">Receipts Out</option>
			<option value="church_lady">Church Lady</option>
			<option value="no_mercy">No Mercy</option>
		</select>

		<label for="rawness">Rawness</label>
		<select
			id="rawness"
			bind:value={rawness}
			onchange={() => onSettingChange('setting')}
		>
			<option value="mild">Mild</option>
			<option value="medium">Medium</option>
			<option value="raw">Raw</option>
		</select>

		<label for="thirdPerson">Third Person</label>
		<select
			id="thirdPerson"
			bind:value={thirdPerson}
			onchange={() => onSettingChange('setting')}
		>
			<option value="sometimes">Sometimes</option>
			<option value="always">Always</option>
			<option value="never">Never</option>
		</select>

		<label for="pageSize">Page Size</label>
		<select
			id="pageSize"
			bind:value={pageSize}
			onchange={() => onSettingChange('setting')}
		>
			<option value="US_Letter">US Letter</option>
			<option value="A4">A4</option>
		</select>

		<label for="border">Border</label>
		<select
			id="border"
			bind:value={border}
			onchange={() => onSettingChange('setting')}
		>
			<option value="decorative">Decorative</option>
			<option value="plain">Plain</option>
			<option value="none">None</option>
		</select>

		<label class="toggle">
			<input
				type="checkbox"
				bind:checked={glitter}
				onchange={() => onSettingChange('setting')}
			/>
			<span>Add glitter overlay</span>
		</label>
	</div>
</details>
