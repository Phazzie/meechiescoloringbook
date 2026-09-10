<!--
Purpose: The **only** rendering in the app of the two controls that decide how much of a coloring
         page is left to colour — lettering size and room to colour.
Why: `textSize` and `whitespaceScale` are `ColoringPageSpec` fields that reached no prompt at all
     until `letteringLine` and `whitespaceLine` were written, and that no reader could set anywhere,
     on any of the fourteen page-making surfaces. `StudioSettingsPanel.svelte` calls itself "the
     app's only say over what a coloring page looks like" and offered neither. This component is the
     other half of that fix, and it owns its CSS for the reason every shared piece in this app does:
     markup has always been reachable by copying and styling has not, which is how the export row and
     the vault each stayed on one surface for a dozen runs.
Info flow: reader picks a value -> `look` (a `PageLookSelection`) -> `onChange` -> the host's spec
           builder -> `/api/generate`.
Invariants:
  1. "Page default" is a real value, not a placeholder. Each control is nullable on purpose: the
     surfaces do not agree on a default and never did — the home studio builds `small` at 50, a
     tools-hub quote page `large` at 35, a list page `large` at 45. Null means the page keeps
     exactly what it builds today, so this control changes nothing until a reader moves it. The
     option names that value rather than saying "Default", so the reader can see what leaving it
     alone gets them.

     Called "Page default" and deliberately **not** "As this page has it", which is what it said
     first. That wording claims provenance the option cannot always carry: on the verdict surfaces
     the picture has not been drawn yet, and on the home studio the null case is the *studio's*
     default for the next page, not the look of a page that was reopened. Naming a page's own
     values while describing a default is the false provenance the Page Controls panel exists to
     prevent.
  2. `effective` is what the page will actually be made with, and is passed in rather than derived
     from `look` here. A control that displayed only the override would report nothing at all until
     it was touched, which is the exact "reports nothing" failure the Page Controls panel was rebuilt
     to stop.
  3. The help line under a control describes the value that is *in effect*, including when that
     value is one this control does not offer — a page carrying 35 or 40 is named by its percentage
     rather than rounded to the nearest step it would fit, because rounding reports a page as
     something it is not.
-->
<script lang="ts">
	import {
		ROOM_TO_COLOUR_HELP,
		ROOM_TO_COLOUR_LABELS,
		ROOM_TO_COLOUR_OPTIONS,
		TEXT_SIZE_HELP,
		TEXT_SIZE_LABELS,
		TEXT_SIZE_OPTIONS,
		describeRoomToColour,
		type PageLookSelection
	} from '$lib/core/page-style';
	import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';

	let {
		look,
		effective,
		idPrefix,
		onChange
	}: {
		/** The reader's override. `null` on a field means "leave the page's own". */
		look: PageLookSelection;
		/** What the next page will actually be made with, once `look` is applied to it. */
		effective: Pick<ColoringPageSpec, 'textSize' | 'whitespaceScale'>;
		/**
		 * Namespaces this instance's element ids.
		 *
		 * Required, not defaulted. Two hosts render this component on the same document — the home
		 * studio's Page Controls panel and, on other surfaces, the panel above the generate button —
		 * and a shared default would have silently produced duplicate ids, which points every
		 * duplicate `<label for>` at the first control on the page.
		 */
		idPrefix: string;
		onChange: (next: PageLookSelection) => void;
	} = $props();

	// `''` is the "as this page has it" option. Empty string rather than the string "null" so a
	// value that failed to match an option cannot be mistaken for a deliberate choice.
	const AS_BUILT = '';

	const textSizeValue = $derived(look.textSize ?? AS_BUILT);
	const roomValue = $derived(look.whitespaceScale === null ? AS_BUILT : String(look.whitespaceScale));

	const textSizeHelp = $derived(TEXT_SIZE_HELP[effective.textSize]);
	const roomHelp = $derived(
		ROOM_TO_COLOUR_HELP[effective.whitespaceScale] ??
			`About ${Math.round(effective.whitespaceScale)}% of the sheet left blank.`
	);
</script>

<div class="page-look">
	<label class="page-look-label" for="{idPrefix}-lettering">Lettering</label>
	<select
		id="{idPrefix}-lettering"
		aria-describedby="{idPrefix}-lettering-help"
		value={textSizeValue}
		onchange={(event) =>
			onChange({
				...look,
				textSize:
					event.currentTarget.value === AS_BUILT
						? null
						: (event.currentTarget.value as ColoringPageSpec['textSize'])
			})}
	>
		<option value={AS_BUILT}>Page default — {TEXT_SIZE_LABELS[effective.textSize]}</option>
		{#each TEXT_SIZE_OPTIONS as value}
			<option {value}>{TEXT_SIZE_LABELS[value]}</option>
		{/each}
	</select>
	<p class="page-look-help" id="{idPrefix}-lettering-help">{textSizeHelp}</p>

	<label class="page-look-label" for="{idPrefix}-room">Room to colour</label>
	<select
		id="{idPrefix}-room"
		aria-describedby="{idPrefix}-room-help"
		value={roomValue}
		onchange={(event) =>
			onChange({
				...look,
				whitespaceScale:
					event.currentTarget.value === AS_BUILT ? null : Number(event.currentTarget.value)
			})}
	>
		<option value={AS_BUILT}>
			Page default — {describeRoomToColour(effective.whitespaceScale)}
		</option>
		{#each ROOM_TO_COLOUR_OPTIONS as value}
			<option value={String(value)}>{ROOM_TO_COLOUR_LABELS[value]}</option>
		{/each}
	</select>
	<p class="page-look-help" id="{idPrefix}-room-help">{roomHelp}</p>
</div>

<style>
	.page-look {
		display: block;
	}

	.page-look-label {
		display: block;
		font-family: var(--font-label);
		font-weight: 700;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gold);
	}

	.page-look select {
		width: 100%;
		margin-top: 0.35rem;
		border-radius: 0.72rem;
		border: 1px solid rgba(201, 162, 39, 0.25);
		padding: 0.62rem 0.72rem;
		font-size: 0.94rem;
		font-family: inherit;
		color: var(--cream);
		background: rgba(7, 7, 15, 0.7);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.page-look select:focus {
		outline: none;
		border-color: var(--gold);
		box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
	}

	.page-look select option {
		background: var(--dark-card-alt);
		color: var(--cream);
	}

	/* Sits under the control it explains, so it reads as part of that control rather than as the
	   heading of the next one — the same rule `StudioSettingsPanel` follows for its own help lines. */
	.page-look-help {
		margin: 0.3rem 0 0.9rem;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--lavender);
	}

	.page-look-help:last-child {
		margin-bottom: 0;
	}
</style>
