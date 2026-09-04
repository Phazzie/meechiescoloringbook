// Purpose: Own the focused-mode catalog — which `/m/<slug>` pages exist, what each one asks the
//          reader for, and how those answers become a `MeechieToolInput`.
// Why: The mode strip on the home page and the `/m/[mode]` route each kept their own hand-written
//      copy of every mode's title, sub-head and button text, and the two had to agree for the
//      home page's focused-mode links to land on the right page. Nothing checked that they did,
//      and an unknown slug silently rendered Random Meechie rather than saying it did not exist —
//      so a drift between the two lists would have shown the wrong mode with a 200. The catalog is
//      derived from `studioModes` instead, which makes them agree by construction.
// Info flow: studioModes + per-tool field definitions -> ModeConfig -> resolveModeSlug(slug) ->
//            MeechieModePage -> /api/tools.
import type { MeechieToolInput } from '../../../contracts/meechie-tool.contract';
import { studioModes } from './meechie-studio';

/** Every answer a mode can ask the reader for. One id per distinct question across all modes. */
export type ModeFieldId =
	| 'situation'
	| 'excuse'
	| 'apology'
	| 'moment'
	| 'claim'
	| 'reality'
	| 'comment'
	| 'dilemma';

/** One question on a mode page. */
export type ModeField = {
	readonly id: ModeFieldId;
	readonly label: string;
	/**
	 * Shown as a placeholder, never as a value. The page used to ship every field pre-filled with
	 * invented drama ("He said he was working late, but I saw him in the club."), which meant the
	 * required-field check could never fail and the button always returned a real verdict about a
	 * fiction the reader never wrote.
	 */
	readonly placeholder: string;
	/** A one-line answer gets an `<input>`; anything the reader might tell a story in gets a textarea. */
	readonly multiline: boolean;
};

/** Everything a `/m/<slug>` page needs to render itself and build its request. */
export type ModeConfig = {
	/** The canonical slug. Also the download filename stem, so it is the one the reader sees. */
	readonly slug: string;
	readonly title: string;
	readonly subhead: string;
	readonly button: string;
	readonly fields: readonly ModeField[];
	readonly buildInput: (values: Readonly<Record<ModeFieldId, string>>) => MeechieToolInput;
};

/** A blank answer for every field, which is what a mode page starts with. */
export const emptyModeFieldValues = (): Record<ModeFieldId, string> => ({
	situation: '',
	excuse: '',
	apology: '',
	moment: '',
	claim: '',
	reality: '',
	comment: '',
	dilemma: ''
});

/**
 * The questions each tool asks, keyed by tool id rather than by slug.
 *
 * The tool id is what actually determines the shape of the request, so two slugs pointing at the
 * same tool cannot drift into asking for different things.
 */
const FIELDS_BY_TOOL: Partial<
	Record<MeechieToolInput['toolId'], readonly ModeField[]>
> = {
	red_flag_or_run: [
		{
			id: 'situation',
			label: 'What happened?',
			placeholder: 'He said he was working late, but the club photo says otherwise.',
			multiline: true
		}
	],
	rate_excuse: [
		{
			id: 'excuse',
			label: 'The excuse, in their words',
			placeholder: 'He said traffic made him three hours late.',
			multiline: true
		}
	],
	apology_translator: [
		{
			id: 'apology',
			label: 'The apology, word for word',
			placeholder: "I'm sorry you feel that way.",
			multiline: true
		}
	],
	receipts: [
		{
			id: 'claim',
			label: 'What they claim',
			placeholder: 'I never said that.',
			multiline: false
		},
		{
			id: 'reality',
			label: 'What actually happened',
			placeholder: 'Said it Tuesday, Thursday, and in the group chat.',
			multiline: false
		}
	],
	clapback: [
		{
			id: 'comment',
			label: 'What they said',
			placeholder: "She said I'm doing too much.",
			multiline: true
		}
	],
	caption_this: [
		{
			id: 'moment',
			label: 'Describe the moment',
			placeholder: 'Diamond nails, city lights, and no explanations.',
			multiline: true
		}
	],
	wwmd: [
		{
			id: 'dilemma',
			label: 'The dilemma',
			placeholder: 'He vanished for days, then came back casual.',
			multiline: true
		}
	],
	// Random Meechie asks for nothing. An empty list is the whole point of it, not an omission.
	random_meechie: []
};

/**
 * Turn a mode's answers into the request its tool expects.
 *
 * Written per tool id, because each tool takes differently named fields and
 * `MeechieToolInputSchema` is a discriminated union — there is no generic shape to fall back on.
 */
const BUILD_INPUT_BY_TOOL: Partial<
	Record<
		MeechieToolInput['toolId'],
		(values: Readonly<Record<ModeFieldId, string>>) => MeechieToolInput
	>
> = {
	red_flag_or_run: (values) => ({
		toolId: 'red_flag_or_run',
		situation: values.situation.trim()
	}),
	rate_excuse: (values) => ({ toolId: 'rate_excuse', excuse: values.excuse.trim() }),
	apology_translator: (values) => ({
		toolId: 'apology_translator',
		apology: values.apology.trim()
	}),
	receipts: (values) => ({
		toolId: 'receipts',
		claim: values.claim.trim(),
		reality: values.reality.trim()
	}),
	clapback: (values) => ({ toolId: 'clapback', comment: values.comment.trim() }),
	caption_this: (values) => ({ toolId: 'caption_this', moment: values.moment.trim() }),
	wwmd: (values) => ({ toolId: 'wwmd', dilemma: values.dilemma.trim() }),
	random_meechie: () => ({ toolId: 'random_meechie' })
};

/**
 * Older slugs that must keep working.
 *
 * These were in the route's hand-written map before the catalog existed, so they may be bookmarked
 * or linked from outside the app. Every one resolves to the canonical mode rather than 404ing —
 * the not-found path below is for typos, not for links that work today.
 */
const SLUG_ALIASES: Readonly<Record<string, string>> = {
	'rate-his-excuse': 'rate-excuse',
	'apology-translator': 'apology-autopsy',
	receipts: 'receipt-check',
	'caption-this': 'caption',
	'what-would-meechie-do': 'meechie-move'
};

/**
 * The catalog, derived from `studioModes` rather than restated alongside it.
 *
 * A mode added to `studioModes` gets its mode card, its home-page focused-mode link *and* its
 * `/m/` page in one edit. Under the previous hand-written map it would have got the first two and
 * then silently served Random Meechie on the third.
 *
 * A mode whose tool has no field definition above is skipped rather than rendered fieldless: a page
 * that cannot ask its question cannot build a valid request, and offering a dead button is worse
 * than not listing the mode.
 */
const buildCatalog = (): ReadonlyMap<string, ModeConfig> => {
	const catalog = new Map<string, ModeConfig>();
	for (const mode of studioModes) {
		const fields = FIELDS_BY_TOOL[mode.toolId];
		const buildInput = BUILD_INPUT_BY_TOOL[mode.toolId];
		if (!fields || !buildInput) continue;
		catalog.set(mode.id, {
			slug: mode.id,
			title: mode.label,
			subhead: mode.help,
			button: mode.cta,
			fields,
			buildInput
		});
	}
	return catalog;
};

const MODE_CATALOG = buildCatalog();

/** Every mode that has a `/m/` page, in the order the studio lists them. */
export const modeCatalog = (): readonly ModeConfig[] => [...MODE_CATALOG.values()];

/**
 * Resolve a URL slug to its mode, or null when there is no such mode.
 *
 * Null rather than a fallback on purpose. The previous route answered every unrecognised slug with
 * Random Meechie and a 200, so a typo — or a link to a mode that had been renamed — quietly served
 * a different mode's page under the requested mode's URL, with nothing on screen to say so.
 */
export const resolveModeSlug = (slug: string): ModeConfig | null =>
	MODE_CATALOG.get(SLUG_ALIASES[slug] ?? slug) ?? null;

/**
 * Whether every question this mode asks has been answered.
 *
 * A mode with no fields (Random Meechie) is always ready, which is the one case a plain
 * "every field is non-empty" check gets right only by accident — stating it here keeps that
 * deliberate rather than incidental.
 */
export const isModeInputComplete = (
	config: ModeConfig,
	values: Readonly<Record<ModeFieldId, string>>
): boolean => config.fields.every((field) => values[field.id].trim().length > 0);
