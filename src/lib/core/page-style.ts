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
 * `textStrokeWidth` joined them in Run 25 — see the block above `LINE_WEIGHT_OPTIONS`. Ten further
 * spec fields decide what the drawing looks like and are still unreachable by a reader; extending
 * the panel to all of them is a separate change and is recorded as one rather than folded in here.
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
	/**
	 * How thick the outlines are, or `null` for the page's own.
	 *
	 * The `ColoringPageSpec` field is `textStrokeWidth`; the reader-facing name is "Line weight",
	 * because "stroke width" is a drawing-program word and the question a reader is actually asking
	 * is whether they can stay inside the lines. The spec field keeps its name — renaming it would
	 * be a contract change for a vocabulary preference.
	 */
	lineWeight: ColoringPageSpec['textStrokeWidth'] | null;
	/**
	 * What shape the letters are, or `null` for the page's own.
	 *
	 * The `ColoringPageSpec` field is `fontStyle`; the reader-facing name is "Letter shape", because
	 * "font style" names a thing a reader chooses in a word processor from a list of typeface names,
	 * and this is not that — there are three shapes and the model draws them by hand. The spec field
	 * keeps its name, for the same reason `textStrokeWidth` did: renaming it would be a contract
	 * change for a vocabulary preference.
	 */
	letterShape: ColoringPageSpec['fontStyle'] | null;
};

/** No override. Every surface starts here, so every surface starts unchanged. */
export const DEFAULT_PAGE_LOOK: PageLookSelection = {
	textSize: null,
	whitespaceScale: null,
	lineWeight: null,
	letterShape: null
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

/*
 * Typed `string | undefined` rather than `Record<number, string>`, which is what these were first.
 * A bare `Record<number, string>` tells the compiler that *every* number has a label, so the `??`
 * fallbacks below and in `PageLookControls` read as dead code to the type checker while being the
 * live path at runtime for every value that is not one of the three steps — and 35, 40 and 45 are
 * all values this app really builds. Making the absence visible is what keeps a future edit from
 * "simplifying" the fallback away and rendering `undefined` at a reader.
 */
export const ROOM_TO_COLOUR_LABELS: Readonly<Record<number, string | undefined>> = {
	25: 'Packed',
	50: 'Balanced',
	75: 'Roomy'
};

export const ROOM_TO_COLOUR_HELP: Readonly<Record<number, string | undefined>> = {
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

/* ------------------------------------------------------------------------------------------------
 * How thick the lines are.
 *
 * `textStrokeWidth` reached the prompt, but as `Stroke: 6px.` — a bare number with no stated
 * reference — under a constant that demanded "thick outlines" whatever the number said. No reader
 * could set it on any of the fourteen page-making surfaces, and nothing in the application reported
 * which value a page had been built with. It is the property that decides whether a printed page can
 * be coloured inside at all, which is why it is the one this run took rather than one of the ten
 * remaining presentation fields.
 * ---------------------------------------------------------------------------------------------- */

/**
 * The line weights the control offers, thinnest first.
 *
 * Four steps rather than three, and **not** an arbitrary spread across the contract's 4-12: the two
 * values this application actually builds are the home studio's 6 and the tool recipes' 9, and both
 * are steps here on purpose. Had they not been, every reader opening a page the app itself made
 * would have been shown a phantom "this page's own" option beside a "Page default" naming the same
 * number — the control apologising for a value it should simply have offered.
 *
 * 4 and 12 are the contract's own ends, so the control spans everything a spec can legally ask for.
 */
export const LINE_WEIGHT_OPTIONS = [4, 6, 9, 12] as const;

/*
 * `string | undefined` rather than `Record<number, string>`, for the reason spelled out above
 * `ROOM_TO_COLOUR_LABELS`: a total `Record<number, …>` tells the compiler every number has a label,
 * which turns the `??` fallback into dead code to the type checker while it stays the live path at
 * runtime. `ChatInterpretationSeam` can return 5, 7, 8, 10 or 11, and a reopened page carries
 * whatever it was built with.
 */
export const LINE_WEIGHT_LABELS: Readonly<Record<number, string | undefined>> = {
	4: 'Fine',
	6: 'Standard',
	9: 'Bold',
	12: 'Chunky'
};

/**
 * What each weight costs and buys, in the reader's terms.
 *
 * Each one names the trade rather than only the virtue. A thicker outline is easier to stay inside
 * and swallows fine detail; a finer one keeps the detail and is unforgiving. A help line that only
 * said "easiest to colour inside" would sell the reader the thickest option every time.
 *
 * None of them names which surface builds which weight, and the first draft of this table named
 * both — "The studio default" on 6, "What every Meechie tool page is built with" on 9. The same
 * component renders these on all fourteen surfaces, so on a mode route the reader would have been
 * told the value in front of them was the *studio's* default. That is the false provenance the
 * "Page default" option was already renamed to avoid, reintroduced one line below it. What the
 * surface builds is already shown, correctly and per surface, by that option.
 */
export const LINE_WEIGHT_HELP: Readonly<Record<number, string | undefined>> = {
	4: 'Thin outlines. Fine detail survives, but they are hard to stay inside with a crayon.',
	6: 'Medium outlines. A fair trade between keeping detail and staying inside the lines.',
	9: 'Thick outlines. Easy to colour inside, and small drawn details start to merge.',
	12: 'Very thick outlines. The easiest to stay inside, and the finest detail is lost to them.'
};

/**
 * Name a line weight the control did not offer.
 *
 * The interpreter can return any whole number from 4 to 12 and a reopened page carries whatever it
 * was built with, so the panel has to describe a value that is not one of its four steps. Naming the
 * number is the honest answer; snapping it to the nearest step would report a page as something it
 * is not — the same rule `describeRoomToColour` follows and for the same reason.
 *
 * Returns the weight alone and never the word "lines". `summarizePageLook` appends it, and a
 * fallback that carried it would render "7px lines lines" there.
 */
export const describeLineWeight = (strokeWidth: number): string =>
	LINE_WEIGHT_LABELS[strokeWidth] ?? `${Math.round(strokeWidth)}px`;

/* ------------------------------------------------------------------------------------------------
 * What shape the letters are.
 *
 * Every page this application makes is a page of lettering — `ColoringPageSpec` has no field that
 * can hold a subject, so the words *are* the drawing — which makes `fontStyle` the field that
 * decides what the picture looks like. It reached the prompt as `Font: block.`, three bare enum
 * tokens, under a constant that demanded `Bold bubble letters.` whatever the field said. `block` is
 * what every one of the thirteen tool and mode pages builds, so that contradiction was not an edge
 * case: it was in the prompt of every tool page the app ever sent. No reader could set the field on
 * any of the fourteen page-making surfaces, and nothing in the application reported which letterform
 * a page had been built with.
 * ---------------------------------------------------------------------------------------------- */

type FontStyle = ColoringPageSpec['fontStyle'];

/**
 * What each letterform looks like, in the reader's terms.
 *
 * Total `Record`s over the contract enum, so a value added to `FontStyleSchema` fails compilation
 * here rather than rendering a blank line under a dropdown — the same rule every other table in
 * this file follows.
 *
 * "Handwritten" rather than the enum's own `hand`, which is a variable name and not a thing anyone
 * would recognise on a page.
 */
export const LETTER_SHAPE_LABELS: Record<FontStyle, string> = {
	rounded: 'Bubble',
	block: 'Block',
	hand: 'Handwritten'
};

/**
 * What each shape costs and buys, in the reader's terms.
 *
 * Each names the trade rather than only the virtue, for the reason `LINE_WEIGHT_HELP` does: a table
 * that only listed what is good about each option would sell the reader the first one every time.
 *
 * None of them says how **heavy** the outlines are or how much of the **sheet** the words cover.
 * Those are the Line weight and Room to colour controls sitting directly above, and a help line
 * here that claimed either would tell the reader two different things about one property — the
 * contradiction this whole run exists to remove from the prompt, reintroduced in the panel.
 */
export const LETTER_SHAPE_HELP: Record<FontStyle, string> = {
	rounded: 'Inflated bubble letters with soft curves. Big open middles to colour in.',
	block: 'Straight-sided capitals, squared off. The plainest shapes and the easiest to read.',
	hand: 'Casual handwriting, uneven on purpose. Reads like a note rather than a printed page.'
};

/**
 * The values the control offers, in the order it lists them.
 *
 * Derived from the label table's keys rather than restated, exactly as the voice controls are: the
 * table is a `Record<FontStyle, string>`, so the *type* already forces it to be total and this list
 * follows automatically. `tests/unit/page-style.test.ts` drives `FontStyleSchema.options` against
 * it, so the seam and the panel are proved equal.
 *
 * Unlike `LINE_WEIGHT_OPTIONS` and `ROOM_TO_COLOUR_OPTIONS` this is the *whole* domain of the field,
 * not a set of steps across a numeric range. So there is no value a page can carry that the control
 * cannot offer, and `PageLookControls` needs no "this page's own" fallback option for it.
 */
export const LETTER_SHAPE_OPTIONS = Object.keys(LETTER_SHAPE_LABELS) as readonly FontStyle[];

/**
 * Name a letterform, for the summary and the read-back.
 *
 * No fallback branch, and that is the difference from `describeLineWeight` and
 * `describeRoomToColour`: those describe numeric fields whose contracts admit values their controls
 * do not offer, so both have to be able to name a value they have no word for. `fontStyle` is an
 * enum and the table is total over it, so every value a spec can legally carry has a label here.
 *
 * Returns the label alone and never the word "letters". `summarizePageLook` appends it, and a
 * value that carried it would render "block letters letters" there — the defect Run 25 shipped
 * once in `describeLineWeight` and fixed before merge.
 */
export const describeLetterShape = (fontStyle: FontStyle): string =>
	LETTER_SHAPE_LABELS[fontStyle];

/**
 * The three look fields as a page will actually be made with them — concrete values, never `null`.
 *
 * The counterpart to `PageLookSelection`, and the distinction is the whole design: a selection is
 * what the reader *overrode* and is nullable per field; this is what the page *gets* once that
 * selection has been applied to whatever the surface builds. Every control, summary and baseline in
 * the app is typed against one or the other, and mixing them up is how a panel comes to report an
 * override instead of an effect — the "reports nothing" failure `PageLookControls`' second invariant
 * exists to prevent.
 *
 * Named because the same `Pick` was spelled out at six declarations across four files once
 * `textStrokeWidth` joined it, and a repeated structural type is one edit away from six that
 * disagree. Adding a fourth look field is now one line here.
 */
export type EffectivePageLook = Pick<
	ColoringPageSpec,
	'textSize' | 'whitespaceScale' | 'textStrokeWidth' | 'fontStyle'
>;

/**
 * Read the look fields off a spec, and nothing else.
 *
 * The four surfaces that host `PageLookControls` each need two of these — what the page will
 * actually be made with, and what it would be made with if the reader cleared their override — and
 * every one of them wrote the same destructure-and-rebuild by hand. That was four copies of the
 * field list before this run and would have been eight edits to add the fourth field, in two
 * different Svelte dialects, with a silent wrong answer as the failure mode: a copy that missed a
 * field does not fail to compile, it just makes the panel describe the page incompletely.
 *
 * Typed to take anything that *has* the look fields rather than a whole `ColoringPageSpec`, so a
 * test can call it on a literal, and to return the exact `EffectivePageLook` shape so nothing else
 * from a spec rides along into a control's props.
 */
export const pageLookOf = (spec: EffectivePageLook): EffectivePageLook => ({
	textSize: spec.textSize,
	whitespaceScale: spec.whitespaceScale,
	textStrokeWidth: spec.textStrokeWidth,
	fontStyle: spec.fontStyle
});

/**
 * Apply a reader's override to a spec, leaving every unset field exactly as the page built it.
 *
 * The one place the override is applied. Pure, and total over the four fields: nothing else in a
 * spec is touched, so a caller cannot accidentally hand a page a different title or a different
 * border by routing it through here.
 */
export const applyPageLook = <T extends EffectivePageLook>(
	spec: T,
	look: PageLookSelection
): T => ({
	...spec,
	textSize: look.textSize ?? spec.textSize,
	whitespaceScale: look.whitespaceScale ?? spec.whitespaceScale,
	textStrokeWidth: look.lineWeight ?? spec.textStrokeWidth,
	fontStyle: look.letterShape ?? spec.fontStyle
});

/**
 * The look half of the collapsed summary, read off the *effective* values.
 *
 * Takes what the page will actually be made with rather than the override, because a summary that
 * read the override would say nothing at all until the reader moved a control — which is precisely
 * the "reports nothing" failure this whole panel was rebuilt to stop.
 */
export const summarizePageLook = (
	look: EffectivePageLook
): string =>
	`${TEXT_SIZE_LABELS[look.textSize].toLowerCase()} ${describeLetterShape(
		look.fontStyle
	).toLowerCase()} lettering · ${describeRoomToColour(
		look.whitespaceScale
	).toLowerCase()} · ${describeLineWeight(look.textStrokeWidth).toLowerCase()} lines`;

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
	look: EffectivePageLook
): string => `${styleSummary} · ${summarizePaperSelection(paper)} · ${summarizePageLook(look)}`;
