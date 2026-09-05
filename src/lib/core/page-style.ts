/*
 * Purpose: The Page Controls' style selection as one value — what it means, what it looks like in
 *          prose, and the single encoder that turns it into the prompt's `Vibe:` line.
 * Why: Five of the seven Page Controls (theme, intensity, rawness, third person, glitter) reached
 *      the page only as an inline template string built inside `StudioState`. Nothing named the
 *      selection, so nothing could store it, compare it, or say what it does — and a reopened page
 *      silently got the *defaults* re-encoded over the choices that actually made it.
 * Info flow: Page Controls -> StyleSelection -> buildStyleHint -> /api/generate -> `Vibe:` line.
 *            The same StyleSelection is what the vault and the draft persist.
 * Invariants: `buildStyleHint` is the only place the hint is composed. Every help/label table is a
 *             total `Record` over its contract enum, so a value added to the seam fails a test
 *             rather than rendering `undefined` to a reader.
 */
import { studioThemes, type StudioTheme } from '$lib/core/meechie-studio';
import {
	MeechieStudioVoiceSettingsSchema,
	type MeechieStudioVoiceSettings
} from '$lib/seams/meechie-studio-text-seam/contract';

type Intensity = MeechieStudioVoiceSettings['intensity'];
type Rawness = MeechieStudioVoiceSettings['rawness'];
type ThirdPerson = MeechieStudioVoiceSettings['thirdPerson'];

/**
 * The values each voice control offers, read off the seam's own enums.
 *
 * Taken from the schema rather than restated as a literal array, so a value added to
 * `MeechieStudioVoiceSettingsSchema` appears in the panel by construction instead of being a
 * dropdown entry someone has to remember to add in a second place.
 */
export const INTENSITY_OPTIONS: readonly Intensity[] =
	MeechieStudioVoiceSettingsSchema.shape.intensity.options;
export const RAWNESS_OPTIONS: readonly Rawness[] =
	MeechieStudioVoiceSettingsSchema.shape.rawness.options;
export const THIRD_PERSON_OPTIONS: readonly ThirdPerson[] =
	MeechieStudioVoiceSettingsSchema.shape.thirdPerson.options;

/**
 * The wig, as the style hint sees it.
 *
 * Only the two fields the hint actually prints. The try-on studio owns the wig *itself* — which one
 * is selected, whether a portrait exists — and that is deliberately not this module's business. A
 * page made while a wig was selected has the wig in its `Vibe:` line, so reproducing that line
 * needs these two strings and nothing else.
 */
export type StyleWig = {
	name: string;
	style: string;
};

/**
 * Everything the reader chose that ends up in the page's `Vibe:` line.
 *
 * `pageSize` and `border` are deliberately absent: they are `ColoringPageSpec` fields, they are
 * already persisted with the spec, and they already come back on reopen. This type is exactly the
 * part of the Page Controls panel that was *not* persisted.
 *
 * It is structurally identical to `StoredStyleSelection` in the CreationStoreSeam contract — the
 * voice nested rather than flattened, which is also how `StudioState` already holds it. Keeping the
 * two shapes the same means the studio stores and restores the value it works with, with no mapping
 * step in between that could transpose two of the three enums and still typecheck.
 */
export type StyleSelection = {
	themeId: string;
	voice: MeechieStudioVoiceSettings;
	glitter: boolean;
	wig?: StyleWig;
};

export const DEFAULT_STYLE_SELECTION: StyleSelection = {
	themeId: studioThemes[0].id,
	voice: {
		intensity: 'receipts_out',
		rawness: 'mild',
		thirdPerson: 'sometimes'
	},
	glitter: false
};

/** The theme a selection names, falling back to the first one when the id is not a theme. */
export const themeForSelection = (selection: StyleSelection): StudioTheme =>
	studioThemes.find((theme) => theme.id === selection.themeId) ?? studioThemes[0];

const GLITTER_FRAGMENT = ' removable glitter overlay accents';

const wigFragment = (wig: StyleWig | undefined): string =>
	wig ? ` featuring ${wig.name} (${wig.style})` : '';

/**
 * The one encoder for the prompt's `Vibe:` line.
 *
 * The exact string this returns is load-bearing in two directions, which is why it lives alone:
 * `PromptAssemblySeam` renders it as the page's whole art direction, and
 * `derivesDenseDecorations` reads it back to decide the page's decoration density. Building it in
 * two places is how those two answers drift apart.
 */
export const buildStyleHint = (selection: StyleSelection): string => {
	const { intensity, rawness, thirdPerson } = selection.voice;
	return `${themeForSelection(selection).styleHint}; ${intensity}; ${rawness}; ${thirdPerson}${
		selection.glitter ? GLITTER_FRAGMENT : ''
	}${wigFragment(selection.wig)}`;
};

/**
 * Whether two selections would produce the same page.
 *
 * Compared field by field rather than by encoding both and comparing the strings. The encoding is
 * lossy about provenance — two different theme ids that are not in `studioThemes` both fall back to
 * the same theme — so equal hints do not mean equal choices, and it is the choices the panel
 * displays.
 */
export const isSameStyleSelection = (a: StyleSelection, b: StyleSelection): boolean =>
	a.themeId === b.themeId &&
	a.voice.intensity === b.voice.intensity &&
	a.voice.rawness === b.voice.rawness &&
	a.voice.thirdPerson === b.voice.thirdPerson &&
	a.glitter === b.glitter &&
	a.wig?.name === b.wig?.name &&
	a.wig?.style === b.wig?.style;

/**
 * What each control's values actually do, in the reader's terms.
 *
 * Total `Record`s over the contract enums. Two tests drive
 * `MeechieStudioVoiceSettingsSchema.shape.<field>.options` against these keys, so adding a value to
 * the seam fails a test instead of rendering a blank line under a dropdown.
 */
export const INTENSITY_LABELS: Record<Intensity, string> = {
	receipts_out: 'Receipts Out',
	church_lady: 'Church Lady',
	no_mercy: 'No Mercy'
};

export const INTENSITY_HELP: Record<Intensity, string> = {
	receipts_out: 'Names what happened, with the details attached.',
	church_lady: 'Disappointed rather than loud. Says it kindly and still says it.',
	no_mercy: 'No cushioning. The shortest true version.'
};

export const RAWNESS_LABELS: Record<Rawness, string> = {
	mild: 'Mild',
	medium: 'Medium',
	raw: 'Raw'
};

export const RAWNESS_HELP: Record<Rawness, string> = {
	mild: 'Clean enough to print for anybody.',
	medium: 'Some bite. Still a page you would hand to a friend.',
	raw: 'Unfiltered wording.'
};

export const THIRD_PERSON_LABELS: Record<ThirdPerson, string> = {
	sometimes: 'Sometimes',
	always: 'Always',
	never: 'Never'
};

export const THIRD_PERSON_HELP: Record<ThirdPerson, string> = {
	sometimes: 'Meechie slips into third person when it lands better.',
	always: 'Meechie always refers to herself by name.',
	never: 'Meechie speaks as "I" throughout.'
};

/**
 * One sentence naming the current selection, for the collapsed panel.
 *
 * The panel is a `<details>` that ships shut, so without this the reader is told a page has
 * "Settings" and nothing about which ones. Glitter is named only when it is on: a summary that
 * reads "no glitter" spends its shortest line on the absence of a thing.
 */
export const summarizeStyleSelection = (selection: StyleSelection): string => {
	const parts = [
		themeForSelection(selection).label,
		INTENSITY_LABELS[selection.voice.intensity],
		RAWNESS_LABELS[selection.voice.rawness]
	];
	if (selection.glitter) {
		parts.push('glitter');
	}
	if (selection.wig) {
		parts.push(selection.wig.name);
	}
	return parts.join(' · ');
};
