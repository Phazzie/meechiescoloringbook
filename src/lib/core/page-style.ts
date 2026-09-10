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
import type { MeechieStudioVoiceSettings } from '$lib/seams/meechie-studio-text-seam/contract';
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';

type Intensity = MeechieStudioVoiceSettings['intensity'];
type Rawness = MeechieStudioVoiceSettings['rawness'];
type ThirdPerson = MeechieStudioVoiceSettings['thirdPerson'];

/**
 * The two Page Controls that are already `ColoringPageSpec` fields.
 *
 * Deliberately *not* folded into `StyleSelection` — they are persisted with the spec and come back
 * on reopen, and that difference is the whole reason `StyleSelection` exists. They are named here
 * only because the panel's one-line summary describes the whole panel, and half of a panel is not
 * what the panel is set to.
 */
export type PaperSelection = {
	pageSize: ColoringPageSpec['pageSize'];
	border: ColoringPageSpec['border'];
};

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
 * The values each voice control offers, in the order the panel lists them.
 *
 * Derived from the label tables' keys rather than restated, and rather than read off the Zod
 * schema at runtime. The tables are `Record<Enum, string>`, so the *type* already forces them to be
 * total: a value added to `MeechieStudioVoiceSettingsSchema` fails compilation here, and these
 * lists follow automatically. That keeps the drift guarantee — the reason the schema was being read
 * in the first place — without core reaching into a validator's representation of its own enums.
 * `tests/unit/page-style.test.ts` drives the schema's `.options` against these, so the seam and the
 * panel are still proved equal, in the place where importing the schema costs nothing.
 */
export const INTENSITY_OPTIONS = Object.keys(INTENSITY_LABELS) as readonly Intensity[];
export const RAWNESS_OPTIONS = Object.keys(RAWNESS_LABELS) as readonly Rawness[];
export const THIRD_PERSON_OPTIONS = Object.keys(THIRD_PERSON_LABELS) as readonly ThirdPerson[];

/* ------------------------------------------------------------------------------------------------
 * How much room there is to colour.
 *
 * `textSize` and `whitespaceScale` are `ColoringPageSpec` fields that reached no prompt at all until
 * `letteringLine` and `whitespaceLine` were written. Making them real is only half the fix: the
 * reader still could not set either one anywhere in the application, on any of the fourteen
 * page-making surfaces. This is the other half.
 *
 * Deliberately only these two. Eleven further spec fields decide what the drawing looks like and are
 * equally unreachable by a reader; extending the panel to all of them is a separate change and is
 * recorded as one rather than folded in here.
 * ---------------------------------------------------------------------------------------------- */

type TextSize = ColoringPageSpec['textSize'];

/**
 * The reader's override of the two look fields, or `null` per field for "leave the page's own".
 *
 * Nullable per field rather than a single concrete value, because the surfaces do not agree on a
 * default and never did: the home studio builds `small` at scale 50, a tools-hub quote page builds
 * `large` at 35, and a tools-hub list page builds `large` at 45. A concrete default here would have
 * had to pick one of those and silently retype the others, changing what every tool page asks for on
 * a run whose job is to make the fields work rather than to redesign the pages.
 *
 * `null` means the page keeps exactly what it builds today. That makes the whole of this feature
 * behaviour-preserving until a reader actually moves a control, which is also why no "has the reader
 * touched this?" flag is needed anywhere: the absence of a choice *is* the null.
 */
export type PageLookSelection = {
	textSize: TextSize | null;
	whitespaceScale: ColoringPageSpec['whitespaceScale'] | null;
};

/** No override. Every surface starts here, so every surface starts unchanged. */
export const DEFAULT_PAGE_LOOK: PageLookSelection = {
	textSize: null,
	whitespaceScale: null
};

/**
 * What each lettering size does to a coloring page, in the reader's terms.
 *
 * A total `Record` over the contract enum, so a value added to `TextSizeSchema` fails compilation
 * here rather than rendering a blank line under a dropdown — the same rule the voice tables follow.
 */
export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
	small: 'Small',
	medium: 'Medium',
	large: 'Large'
};

export const TEXT_SIZE_HELP: Record<TextSize, string> = {
	small: 'Small lettering. Leaves most of the sheet free to colour.',
	medium: 'Medium lettering. About half words, half space.',
	large: 'Large lettering. The words are most of the page — easiest to read, least to colour.'
};

export const TEXT_SIZE_OPTIONS = Object.keys(TEXT_SIZE_LABELS) as readonly TextSize[];

/**
 * The blank-space settings the control offers, as whole percentages of the sheet.
 *
 * Three named steps rather than a 0-100 slider. The field admits any number in range and pages built
 * elsewhere in the app legitimately carry 35, 40 and 45; those keep working and are shown as the
 * page's own value. What a reader needs is not a hundred positions, it is three answers to "how much
 * of this sheet do I get to colour?"
 */
export const ROOM_TO_COLOUR_OPTIONS = [25, 50, 75] as const;

export const ROOM_TO_COLOUR_LABELS: Record<number, string> = {
	25: 'Packed',
	50: 'Balanced',
	75: 'Roomy'
};

export const ROOM_TO_COLOUR_HELP: Record<number, string> = {
	25: 'About a quarter of the sheet left blank. A full page with a little room around it.',
	50: 'About half the sheet left blank.',
	75: 'About three quarters of the sheet left blank. Lots of room to colour.'
};

/**
 * Name a whitespace value the control did not offer.
 *
 * A page built by the tools hub carries 35 or 45 and a reopened page can carry anything the
 * interpreter chose, so the panel has to be able to describe a value that is not one of its three
 * steps. Naming the percentage is the honest answer; rounding it to the nearest step would report a
 * page as something it is not.
 */
export const describeRoomToColour = (whitespaceScale: number): string =>
	ROOM_TO_COLOUR_LABELS[whitespaceScale] ?? `${Math.round(whitespaceScale)}% blank`;

/**
 * Apply a reader's override to a spec, leaving every unset field exactly as the page built it.
 *
 * The one place the override is applied. Pure, and total over the two fields: nothing else in a spec
 * is touched, so a caller cannot accidentally hand a page a different title or a different border by
 * routing it through here.
 */
export const applyPageLook = <T extends Pick<ColoringPageSpec, 'textSize' | 'whitespaceScale'>>(
	spec: T,
	look: PageLookSelection
): T => ({
	...spec,
	textSize: look.textSize ?? spec.textSize,
	whitespaceScale: look.whitespaceScale ?? spec.whitespaceScale
});

/**
 * The look half of the collapsed summary, read off the *effective* values.
 *
 * Takes what the page will actually be made with rather than the override, because a summary that
 * read the override would say nothing at all until the reader moved a control — which is precisely
 * the "reports nothing" failure this whole panel was rebuilt to stop.
 */
export const summarizePageLook = (
	look: Pick<ColoringPageSpec, 'textSize' | 'whitespaceScale'>
): string =>
	`${TEXT_SIZE_LABELS[look.textSize].toLowerCase()} lettering · ${describeRoomToColour(
		look.whitespaceScale
	).toLowerCase()}`;

/**
 * The phrasings the collapsed summary uses, where a bare label would not survive being read out of
 * its control.
 *
 * "Sometimes" and "Decorative" mean something under a labelled dropdown and nothing in a row of
 * values separated by dots, so the summary says what they are about. Theme, intensity and rawness
 * keep their labels: those read as a description of a voice on their own.
 */
const THIRD_PERSON_SUMMARY: Record<ThirdPerson, string> = {
	sometimes: 'sometimes in third person',
	always: 'always in third person',
	never: 'never in third person'
};

const PAGE_SIZE_SUMMARY: Record<PaperSelection['pageSize'], string> = {
	US_Letter: 'US Letter',
	A4: 'A4'
};

const BORDER_SUMMARY: Record<PaperSelection['border'], string> = {
	decorative: 'decorative border',
	plain: 'plain border',
	none: 'no border'
};

/**
 * One sentence naming the current style selection, for the collapsed panel.
 *
 * The panel is a `<details>` that ships shut, so without this the reader is told a page has
 * "Settings" and nothing about which ones. Glitter is named only when it is on: a summary that
 * reads "no glitter" spends its shortest line on the absence of a thing.
 *
 * This is the *style* half. `summarizePageControls` is what the panel renders, and it exists
 * because this half alone left three of the seven controls — third person, page size and border —
 * moving without the summary changing, under a panel whose whole claim is that it reports itself.
 * The split is kept because the two halves are not equally knowable: a reopened page can have a
 * style that is not on file while its paper always is, and the panel substitutes for exactly this
 * half in that case.
 */
export const summarizeStyleSelection = (selection: StyleSelection): string => {
	const parts = [
		themeForSelection(selection).label,
		INTENSITY_LABELS[selection.voice.intensity],
		RAWNESS_LABELS[selection.voice.rawness],
		THIRD_PERSON_SUMMARY[selection.voice.thirdPerson]
	];
	if (selection.glitter) {
		parts.push('glitter');
	}
	if (selection.wig) {
		parts.push(selection.wig.name);
	}
	return parts.join(' · ');
};

/** The paper half of the summary, which is known even when the style is not. */
export const summarizePaperSelection = (paper: PaperSelection): string =>
	`${PAGE_SIZE_SUMMARY[paper.pageSize]} · ${BORDER_SUMMARY[paper.border]}`;

/**
 * The whole panel in one line: every control it holds, in the order it lists them.
 *
 * Takes the style half as an already-composed string rather than as a `StyleSelection`, because the
 * panel replaces it with "this page's style is not on file" when the page on screen has no stored
 * style — and the paper still has to be reported in that case, since page size and border are
 * `ColoringPageSpec` fields and always came back with the page.
 */
export const summarizePageControls = (
	styleSummary: string,
	paper: PaperSelection,
	look: Pick<ColoringPageSpec, 'textSize' | 'whitespaceScale'>
): string => `${styleSummary} · ${summarizePaperSelection(paper)} · ${summarizePageLook(look)}`;
