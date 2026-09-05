<!--
Purpose: The home studio's Page Controls — theme, voice, glitter, page size and border.
Why: This is the app's only say over what a coloring page looks like, and it used to be seven
     unexplained widgets that reported nothing. Every value now says what it does, the selected
     theme is announced rather than merely tinted, and a change that fails says so here instead of
     surfacing in another panel as a draft problem.
Info flow: User picks a setting → bind syncs to parent → onSettingChange rebuilds the spec.
Critical invariants — this panel describes a page, so it must never describe one that is not there:

  1. A finished page keeps the style it was made with. The controls stop speaking for a page once
     it has a picture on it, which is why the summary reads the page's captured style rather than
     the live values and why the lede below says "once a page has a picture on it". Binding any
     display here straight to a control undoes that: the glitter overlay was, and toggling the
     checkbox visibly restyled a page nobody had remade.
  2. Live controls are never attributed to a page whose stored style is unknown. A record saved
     before styles were stored restores no style, and this panel says so rather than presenting the
     reader's own settings as that page's. What the reader may still do is *choose* one, when there
     is no picture to contradict them — the notice goes then, because the answer is now known.
  3. Everything this panel reports about a check is about a check it caused. `settingsIssues` is
     derived, not copied, so it cannot outlive the finding it describes, and it empties as soon as
     anything else re-checks the spec. Copying a value here is how a fixed page went on being
     reported as broken.
-->
<script lang="ts">
	import { studioThemes } from '$lib/core/meechie-studio';
	import {
		INTENSITY_HELP,
		INTENSITY_LABELS,
		INTENSITY_OPTIONS,
		RAWNESS_HELP,
		RAWNESS_LABELS,
		RAWNESS_OPTIONS,
		THIRD_PERSON_HELP,
		THIRD_PERSON_LABELS,
		THIRD_PERSON_OPTIONS,
		summarizePageControls,
		summarizeStyleSelection,
		type StyleSelection
	} from '$lib/core/page-style';
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
		styleSelectionUnknown = false,
		settingsError = '',
		settingsIssues = [],
		onSettingChange
	}: {
		selectedThemeId: string;
		intensity: StyleSelection['voice']['intensity'];
		rawness: StyleSelection['voice']['rawness'];
		thirdPerson: StyleSelection['voice']['thirdPerson'];
		pageSize: PageSize;
		border: BorderChoice;
		glitter: boolean;
		/** The page on screen was saved before styles were stored with pages. */
		styleSelectionUnknown?: boolean;
		/** A change whose check could not be run at all, reported beside the controls. */
		settingsError?: string;
		/**
		 * What the spec check found wrong with the page, after a change made from this panel.
		 *
		 * Separate from `settingsError` because the two are different facts and were being reported
		 * as one. `settingsError` is "the check did not run"; this is "the check ran and the page
		 * did not pass". Only the first ever reached the reader here, and it is the rarer of the
		 * two — an ordinary contract failure (a title the provider returned too long, say) resolves
		 * normally with `ok: false`, so it showed up only in System Trace, which is the other panel
		 * this run took a settings failure out of.
		 */
		settingsIssues?: readonly string[];
		// The source is passed, not inferred. A theme chip fires this handler even when the reader
		// clicks the chip that is already active, so comparing theme IDs cannot tell "the reader
		// picked a theme" from "some other control changed" — and on a reopened page, whose real
		// theme was never recorded, the comparison gets it wrong in both directions.
		onSettingChange: (source: 'theme' | 'setting') => Promise<void>;
	} = $props();

	// Whether the panel is expanded, mirrored from the element's own `open` on every toggle.
	let open = $state(false);

	// The summary reads the live controls, so it keeps describing the page while the panel is shut.
	// The wig is deliberately absent: it belongs to the try-on studio's own summary, and naming it
	// here would put a second, staler copy of that fact on the page.
	//
	// Except when the page's own style is not on file. The panel ships shut, so summarising the
	// reader's controls there stated exactly the false provenance this whole panel exists to stop —
	// with the correction hidden inside, visible only to a reader who chose to open it. The paper is
	// still named in that case: page size and border are `ColoringPageSpec` fields, so they came
	// back with the page and are the one part of it that is on file.
	//
	// Every control the panel holds is in here. It used to name four of the seven, so a reader who
	// changed Third Person, Page Size or Border and shut the panel watched the line they had just
	// changed stay exactly as it was — the same "reports nothing" the panel was rebuilt to stop.
	const styleSummary = $derived(
		styleSelectionUnknown
			? "This page's style is not on file"
			: summarizeStyleSelection({
					themeId: selectedThemeId,
					voice: { intensity, rawness, thirdPerson },
					glitter
				})
	);
	const summary = $derived(summarizePageControls(styleSummary, { pageSize, border }));
</script>

<details class="settings-panel" bind:open>
	<summary>
		<span>
			<span class="eyebrow">Page Controls</span>
			<!-- Was the constant "Page Controls", so a shut panel said what it was and nothing about
			     what it was set to. -->
			<strong>{summary}</strong>
		</span>
		<!-- Was the constant "Open", which went on reading "Open" while the panel stood open. -->
		<span aria-hidden="true">{open ? 'Close' : 'Open'}</span>
	</summary>

	<div class="settings-content">
		{#if styleSelectionUnknown}
			<!-- The last clause used to read "changing any of them will restyle the page", which was
			     true when it was written and stopped being true two rounds later: the page on screen
			     is now built from the snapshot taken with the artifact, so a control change leaves it
			     alone. It was also contradicting the lede directly below it. -->
			<p class="settings-notice" data-testid="home-style-unknown">
				This page's own look was not stored with it. These controls still show your settings, not
				the ones that made it — so they describe the next page you make, not this one.
			</p>
		{/if}

		<!-- The second sentence used to be unconditional, and a review caught that it is only true of a
		     page with a picture on it. A reopened text-only record has no artifact, so the preview's
		     paper follows the controls live — correctly, because there it *is* a preview of the next
		     page rather than a claim about a finished one. The promise now says which case it is
		     about instead of over-claiming for both. -->
		<p class="settings-lede">
			These decide how the next page looks. Once a page has a picture on it, it keeps the look it
			was made with until you make it again.
		</p>

		<fieldset>
			<legend>Theme</legend>
			<p class="field-help">The artwork Meechie draws around the words.</p>
			<!-- Was eight buttons in a bare div whose only "selected" signal was a background colour,
			     so the active theme was invisible to anything that does not see colour.
			     `aria-pressed` rather than a `radiogroup` of `role="radio"`: a real radiogroup owes
			     the reader arrow-key navigation and a roving tabindex, and claiming the role without
			     them trades an invisible state for a broken interaction. The enclosing fieldset and
			     legend already group these, so the role was only ever carrying the state. -->
			<div class="theme-grid">
				{#each studioThemes as theme}
					<button
						type="button"
						aria-pressed={selectedThemeId === theme.id}
						class="theme-chip"
						class:active={selectedThemeId === theme.id}
						onclick={async () => {
							selectedThemeId = theme.id;
							await onSettingChange('theme');
						}}
					>
						<span aria-hidden="true">{theme.icon}</span>
						{theme.label}
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Meechie's voice</legend>
			<p class="field-help">How she words the verdict.</p>

			<label for="intensity">Intensity</label>
			<select
				id="intensity"
				aria-describedby="intensity-help"
				bind:value={intensity}
				onchange={() => onSettingChange('setting')}
			>
				{#each INTENSITY_OPTIONS as value}
					<option {value}>{INTENSITY_LABELS[value]}</option>
				{/each}
			</select>
			<p class="value-help" id="intensity-help">{INTENSITY_HELP[intensity]}</p>

			<label for="rawness">Rawness</label>
			<select
				id="rawness"
				aria-describedby="rawness-help"
				bind:value={rawness}
				onchange={() => onSettingChange('setting')}
			>
				{#each RAWNESS_OPTIONS as value}
					<option {value}>{RAWNESS_LABELS[value]}</option>
				{/each}
			</select>
			<p class="value-help" id="rawness-help">{RAWNESS_HELP[rawness]}</p>

			<label for="thirdPerson">Third Person</label>
			<select
				id="thirdPerson"
				aria-describedby="third-person-help"
				bind:value={thirdPerson}
				onchange={() => onSettingChange('setting')}
			>
				{#each THIRD_PERSON_OPTIONS as value}
					<option {value}>{THIRD_PERSON_LABELS[value]}</option>
				{/each}
			</select>
			<p class="value-help" id="third-person-help">{THIRD_PERSON_HELP[thirdPerson]}</p>
		</fieldset>

		<fieldset>
			<legend>Paper</legend>
			<p class="field-help">The sheet the page is laid out for.</p>

			<label for="pageSize">Page Size</label>
			<select
				id="pageSize"
				aria-describedby="page-size-help"
				bind:value={pageSize}
				onchange={() => onSettingChange('setting')}
			>
				<option value="US_Letter">US Letter</option>
				<option value="A4">A4</option>
			</select>
			<p class="value-help" id="page-size-help">
				{pageSize === 'US_Letter'
					? '8.5 × 11 in — the usual size in the US.'
					: '210 × 297 mm — the usual size most other places.'}
			</p>

			<label for="border">Border</label>
			<select
				id="border"
				aria-describedby="border-help"
				bind:value={border}
				onchange={() => onSettingChange('setting')}
			>
				<option value="decorative">Decorative</option>
				<option value="plain">Plain</option>
				<option value="none">None</option>
			</select>
			<p class="value-help" id="border-help">
				{border === 'decorative'
					? 'A drawn frame with something to colour in.'
					: border === 'plain'
						? 'A simple line around the edge.'
						: 'No frame — the words run to the margin.'}
			</p>

			<label class="toggle">
				<input
					type="checkbox"
					aria-describedby="glitter-help"
					bind:checked={glitter}
					onchange={() => onSettingChange('setting')}
				/>
				<span>Add glitter overlay</span>
			</label>
			<p class="value-help" id="glitter-help">
				Asks for sparkle accents you can colour over or leave white.
			</p>
		</fieldset>

		{#if settingsError}
			<p class="settings-error" role="alert" data-testid="home-settings-error">
				That change was applied but could not be checked: {settingsError}
			</p>
		{/if}

		{#if settingsIssues.length > 0}
			<!-- Deliberately not phrased as "that change broke the page". The check runs over the
			     whole spec, so what it reports can be something the provider's own words did long
			     before this control moved — a title over the length limit, say. Naming the failure
			     without naming a culprit is the true version, and it is still reported here because
			     this is where the reader was when the check ran. -->
			<div class="settings-error" role="alert" data-testid="home-settings-issues">
				<p>That change was applied. The page did not pass its check:</p>
				<ul>
					{#each settingsIssues as issue}
						<li>{issue}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</details>

<style>
	/* Below 1100px `.settings-content` becomes a two-column grid (see `+page.svelte`). The three
	   fieldsets are the cells that should flow; the panel-wide prose is not a column of the form, so
	   it spans. Without this the lede stranded an empty half-panel beside the theme list. Inert when
	   the container is not a grid. */
	.settings-lede,
	.settings-notice,
	.settings-error {
		grid-column: 1 / -1;
	}

	.settings-content fieldset {
		margin: 0 0 1.25rem;
		padding: 0;
		border: 0;
	}

	.settings-content fieldset:last-of-type {
		margin-bottom: 0.5rem;
	}

	.settings-content legend {
		padding: 0;
		font-family: var(--font-label);
		font-size: 0.8rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold-bright);
	}

	.settings-lede,
	.field-help {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--lavender);
	}

	/* Sits under the control it explains, so it reads as part of that control rather than as the
	   heading of the next one. */
	.value-help {
		margin: 0.3rem 0 0.9rem;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--lavender);
	}

	.settings-notice {
		margin: 0 0 1rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--gold-border);
		border-radius: 6px;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--cream);
		background: rgba(201, 162, 39, 0.1);
	}

	.settings-error {
		margin: 0.5rem 0 0;
		padding: 0.7rem 0.85rem;
		border: 1px solid rgba(232, 0, 106, 0.45);
		border-radius: 6px;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--cream);
		background: rgba(232, 0, 106, 0.12);
	}

	.settings-error p {
		margin: 0;
	}

	.settings-error ul {
		margin: 0.4rem 0 0;
		padding-left: 1.15rem;
	}
</style>
