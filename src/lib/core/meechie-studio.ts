// Purpose: Centralize Meechie studio modes, control metadata, and spec mapping.
// Why: Keep UI pricing/budget labels and page text generation deterministic.
// Info flow: Metadata + AI text output -> UI controls -> ColoringPageSpec.
import {
	MAX_LABEL_LENGTH,
	MAX_TITLE_LENGTH,
	type ColoringPageSpec
} from '../../../contracts/spec-validation.contract';
import type { CreationRecord, DraftRecord } from '$lib/seams/creation-store-seam/contract';
import type { MeechieStudioTextAction, MeechieStudioTextOutput } from '$lib/seams/meechie-studio-text-seam/contract';
import type { MeechieToolInput } from '../../../contracts/meechie-tool.contract';

/**
 * How many times the reader may rework one verdict before Meechie asks them for new facts instead.
 *
 * It counts *rewrites of the answer on screen*, not the act of asking. Asking is what refills it:
 * a new verdict starts a new round with the full allowance, so the studio can never reach a state
 * where the reader has nothing on the paper and no way to put anything there.
 *
 * It is a churn guardrail, not a spend control. Spend is metered server-side, per caller, by the
 * quota gate on `/api/meechie-studio-text` — which is the number `AiQuotaSnapshot` reports.
 */
export const DEFAULT_REVISION_BUDGET = 3;

// Seed and fallback used for the internal spec and legacy records. It is not the idle
// on-screen preview: before generated text exists, the UI shows a static demo PNG.
export const DEFAULT_STUDIO_TEXT_OUTPUT: MeechieStudioTextOutput = {
	verdict: 'Meechie already clocked it.',
	// The owner-ruled default. Must stay a line that exists in the voice pack — the previous
	// default quoted a fabricated line that was removed on 2026-08-25.
	quote: 'You should have fucked the landlord, not the dopeman.',
	pageTitle: 'THE LANDLORD',
	pageItems: [
		{ number: 1, label: 'THE RENT' },
		{ number: 2, label: 'THE DOPEMAN' },
		{ number: 3, label: 'WHAT IT COST' }
	],
	qualityState: 'ready',
	revisionNote: 'Approved preview line. Generate to get yours.'
};

/**
 * What an action costs.
 *
 * `paid` means it reaches the AI text provider and is charged against the caller's server-side
 * quota; `free` means it happens in the browser and costs nothing. There used to be a third grade,
 * `unclassified`, and every one of the five provider-calling actions carried it — so the app could
 * not say whether the thing it was rationing cost anything, and no code outside a unit test ever
 * read the field. They are provider calls. They are paid.
 */
export type CostClass = 'free' | 'paid';

type StudioActionDefinition = {
	id: string;
	label: string;
	costClass: CostClass;
	countsAgainstRevisionBudget: boolean;
	/** Puts a new question to Meechie, and so refills the rewrite allowance. See `studioActionStartsRound`. */
	startsRound?: boolean;
	aiAction?: MeechieStudioTextAction;
};

export const studioActions = [
	{
		id: 'generate_text',
		label: 'Generate Verdict',
		costClass: 'paid',
		// Asking is not a rewrite. This is the action that *starts* a round, so counting it against
		// the round's own rewrite allowance made the meter's first number a lie ("3 left" bought one
		// verdict and two rewrites) and let the studio strand a reader with an empty page and every
		// button disabled. See `studioActionStartsRound`.
		countsAgainstRevisionBudget: false,
		startsRound: true,
		aiAction: 'generate'
	},
	{
		id: 'regenerate',
		label: 'Regenerate',
		costClass: 'paid',
		countsAgainstRevisionBudget: true,
		aiAction: 'regenerate'
	},
	{
		id: 'make_prettier',
		label: 'Make Prettier',
		costClass: 'paid',
		countsAgainstRevisionBudget: true,
		aiAction: 'make_prettier'
	},
	{
		id: 'make_meaner',
		label: 'Make Meaner',
		costClass: 'paid',
		countsAgainstRevisionBudget: true,
		aiAction: 'make_meaner'
	},
	{
		id: 'make_more_specific',
		label: 'More Specific',
		costClass: 'paid',
		countsAgainstRevisionBudget: true,
		aiAction: 'make_more_specific'
	},
	{ id: 'download_pdf', label: 'Download PDF', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'export_png', label: 'Export PNG', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'copy_quote', label: 'Copy Quote', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'save_to_vault', label: 'Save to Vault', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'change_theme', label: 'Theme', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'change_page_size', label: 'Page Size', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'change_border', label: 'Border', costClass: 'free', countsAgainstRevisionBudget: false },
	{ id: 'add_glitter', label: 'Add Glitter', costClass: 'free', countsAgainstRevisionBudget: false }
] as const satisfies readonly StudioActionDefinition[];

export type StudioActionMetadata = (typeof studioActions)[number];
export type StudioActionId = StudioActionMetadata['id'];
export type StudioTextActionMetadata = Extract<
	StudioActionMetadata,
	{ readonly aiAction: MeechieStudioTextAction }
>;
export type StudioTextActionId = StudioTextActionMetadata['id'];

const isStudioTextAction = (action: StudioActionMetadata): action is StudioTextActionMetadata =>
	'aiAction' in action;

export class MissingStudioTextActionMetadataError extends Error {
	constructor(id: string) {
		super(`Studio action is missing aiAction metadata: ${id}`);
		this.name = 'MissingStudioTextActionMetadataError';
	}
}

export type StudioMode = {
	id: string;
	label: string;
	shortLabel: string;
	toolId: MeechieToolInput['toolId'];
	image: string;
	icon: string;
	themeColor: string;
	placeholder: string;
	cta: string;
	help: string;
};

export const studioModes: StudioMode[] = [
	{
		id: 'who-fucked-up',
		label: 'Who Fucked Up?',
		shortLabel: 'Who',
		toolId: 'red_flag_or_run',
		image: '/meechie/meechie-verdict-girl.png',
		icon: '!',
		themeColor: '#e8006a',
		placeholder: 'He said he was working late, but the club photo says otherwise.',
		cta: 'Generate Verdict',
		help: 'Tell Meechie what happened. She names the accountability.'
	},
	{
		id: 'rate-excuse',
		label: 'Rate His Excuse',
		shortLabel: 'Rate',
		toolId: 'rate_excuse',
		image: '/meechie/meechie-receipts.png',
		icon: '#',
		themeColor: '#c9a227',
		placeholder: 'He said traffic made him three hours late.',
		cta: 'Score the Excuse',
		help: 'Drop the excuse and get a score with commentary.'
	},
	{
		id: 'apology-autopsy',
		label: 'Apology Autopsy',
		shortLabel: 'Sorry',
		toolId: 'apology_translator',
		image: '/meechie/meechie-chosen.png',
		icon: '"',
		themeColor: '#8b16c2',
		placeholder: "I'm sorry you feel that way.",
		cta: 'Translate It',
		help: 'Turn a soft apology into what it really said.'
	},
	{
		id: 'receipt-check',
		label: 'Receipt Check',
		shortLabel: 'Receipts',
		toolId: 'receipts',
		image: '/meechie/meechie-receipts.png',
		icon: '$',
		themeColor: '#00c896',
		placeholder: 'Claim: I never said that. Reality: the group chat says otherwise.',
		cta: 'Check Receipts',
		help: 'Compare the claim with the proof.'
	},
	{
		id: 'clapback',
		label: 'Clapback Card',
		shortLabel: 'Clap',
		toolId: 'clapback',
		image: '/meechie/meechie-chosen.png',
		icon: '<',
		themeColor: '#f0c44a',
		placeholder: "She said I'm doing too much.",
		cta: 'Write the Line',
		help: 'Make the response short, printable, and sharp.'
	},
	{
		id: 'caption',
		label: 'Caption Drop',
		shortLabel: 'Caption',
		toolId: 'caption_this',
		image: '/meechie/meechie-banner.png',
		icon: '@',
		themeColor: '#b8aacf',
		placeholder: 'Diamond nails, city lights, and no explanations.',
		cta: 'Caption This',
		help: 'Turn the moment into a coloring-page line.'
	},
	{
		id: 'meechie-move',
		label: 'Meechie Move',
		shortLabel: 'Move',
		toolId: 'wwmd',
		image: '/meechie/meechie-verdict-girl.png',
		icon: '>',
		themeColor: '#e8006a',
		placeholder: 'He vanished for days, then came back casual.',
		cta: 'Name the Move',
		help: 'Get the next move with consequences attached.'
	},
	{
		id: 'random',
		label: 'Random Meechie',
		shortLabel: 'Random',
		toolId: 'random_meechie',
		image: '/meechie/meechie-coloring-page.png',
		icon: '*',
		themeColor: '#c9a227',
		placeholder: 'No evidence needed. Let Meechie pull a line.',
		cta: 'Surprise Me',
		help: 'Generate a fresh Meechie quote without a setup.'
	}
];

// --- Mode rotation helpers ---
// Why: Show 3 modes at a time so the strip isn't overwhelming.
//      1 mode rotates monthly (changes on the 1st), 2 rotate weekly.
//      All 8 modes get equal exposure over time.

const getMonthKey = (): number => {
	const now = new Date();
	return now.getFullYear() * 12 + now.getMonth();
};

const getWeekNumber = (): number =>
	Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

export const getMonthlyMode = (): StudioMode =>
	studioModes[getMonthKey() % studioModes.length];

export const getWeeklyModes = (): StudioMode[] => {
	const monthly = getMonthlyMode();
	const pool = studioModes.filter((m) => m.id !== monthly.id);
	const offset = (getWeekNumber() * 2) % pool.length;
	const weekly = [pool[offset], pool[(offset + 1) % pool.length]];
	return [monthly, ...weekly];
};

export type StudioTheme = {
	id: string;
	label: string;
	icon: string;
	styleHint: string;
	image: string;
};

export const studioThemes: StudioTheme[] = [
	{
		id: 'crown-energy',
		label: 'Crown Energy',
		icon: 'C',
		styleHint: 'gold crown ornaments, royal glam outlines',
		image: '/meechie/meechie-banner.png'
	},
	{
		id: 'pretty-petty',
		label: 'Pretty & Petty',
		icon: 'P',
		styleHint: 'pretty petty glam, bows, lashes, diamond accents',
		image: '/meechie/meechie-chosen.png'
	},
	{
		id: 'church-glam',
		label: 'Church Glam',
		icon: 'G',
		styleHint: 'Sunday best, fan, pearls, dramatic church hat',
		image: '/meechie/meechie-verdict-girl.png'
	},
	{
		id: 'receipts',
		label: 'Receipts',
		icon: 'R',
		styleHint: 'receipt collage, timestamp details, message screenshots as line art',
		image: '/meechie/meechie-receipts.png'
	},
	{
		id: 'family-reunion',
		label: 'Family Reunion',
		icon: 'F',
		styleHint: 'cookout table, folding chairs, auntie glamour',
		image: '/meechie/meechie-coloring-page.png'
	},
	{
		id: 'beauty-supply',
		label: 'Beauty Supply Oracle',
		icon: 'B',
		styleHint: 'beauty supply aisle, lashes, gloss, oracle energy',
		image: '/meechie/meechie-chosen.png'
	},
	{
		id: 'main-character',
		label: 'Main Character',
		icon: 'M',
		styleHint: 'main character pose, bold glam lettering, spotlight outlines',
		image: '/meechie/meechie-receipts.png'
	},
	{
		id: 'door-crack',
		label: 'Door-Crack Energy',
		icon: 'E',
		styleHint: 'dramatic doorway, side-eye, hallway light, clean outlines',
		image: '/meechie/meechie-verdict-girl.png'
	}
];

export const getStudioAction = (id: StudioActionId): StudioActionMetadata => {
	const action = studioActions.find((item) => item.id === id);
	if (!action) {
		throw new Error(`Unknown studio action: ${id}`);
	}
	return action;
};

export const getStudioTextAction = (id: StudioTextActionId): StudioTextActionMetadata => {
	const action = getStudioAction(id);
	// Runtime guard remains intentional for JS consumers and future metadata drift.
	if (!isStudioTextAction(action)) {
		throw new MissingStudioTextActionMetadataError(id);
	}
	return action;
};

export const consumeStudioActionBudget = (remainingBudget: number, actionId: StudioActionId): number => {
	const action = getStudioAction(actionId);
	return action.countsAgainstRevisionBudget ? Math.max(remainingBudget - 1, 0) : remainingBudget;
};

/**
 * Does this action start a fresh round — a new question put to Meechie — rather than rework the
 * answer already on screen?
 *
 * Only `generate_text` does. It is what refills the rewrite allowance, which is why the allowance
 * can honestly call itself per-verdict: the reader always has a way to get more that does not
 * involve reloading the page.
 */
export const studioActionStartsRound = (actionId: StudioActionId): boolean => {
	const action = getStudioAction(actionId);
	return 'startsRound' in action && action.startsRound === true;
};

/**
 * Is this action one that spends money — a call to the AI text provider?
 *
 * Read off the metadata rather than the budget flag. The two used to be the same field, which is
 * how `generate_text` ended up blocked by a counter meant for rewrites: the only guard that knew a
 * request was already in flight was the budget's.
 */
const isBillableStudioAction = (actionId: StudioActionId): boolean =>
	isStudioTextAction(getStudioAction(actionId));

export const canRunStudioAction = (
	actionId: StudioActionId,
	state: { remainingBudget: number; isRunning: boolean }
): boolean => {
	const action = getStudioAction(actionId);
	// Every provider call waits for the one in flight, whether or not it spends the rewrite
	// allowance. Keying this off `countsAgainstRevisionBudget` would leave Generate Verdict
	// double-submittable the moment it stopped counting against the allowance.
	if (state.isRunning && isBillableStudioAction(actionId)) {
		return false;
	}
	if (action.countsAgainstRevisionBudget && state.remainingBudget <= 0) {
		return false;
	}
	return true;
};

const normalizeSpecText = (value: string, fallback: string, maxLength: number): string => {
	const normalized = value
		.normalize('NFKD')
		.replace(/&/g, ' ')
		.replace(/[^A-Za-z0-9 .,!?'":;\-()]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();
	const safe = normalized.length > 0 ? normalized : fallback;
	return safe.slice(0, maxLength).trim();
};

const normalizeSpecLabel = (value: string, fallback: string): string =>
	normalizeSpecText(value, fallback, MAX_LABEL_LENGTH);

const normalizeSpecTitle = (value: string, fallback: string): string =>
	normalizeSpecText(value, fallback, MAX_TITLE_LENGTH);

/**
 * The page's own words, for a spec whose text was not persisted beside it.
 *
 * The page's own words only. This used to lead with the record's `assembledPrompt`, which on a
 * generated page is the image-generation prompt — a machine instruction carrying composition
 * directives, never anything Meechie said — and reopening put it in her mouth as the quote. A page
 * with no printed items hit that every time: a toolkit quote page, where the title *is* the page,
 * had nothing else to offer. There is no case where the prompt is the right answer here, so it is
 * gone rather than demoted.
 *
 * Exported because a caller that gets `null` from the builders below still has a page in front of
 * it and still needs its words. Answering that with a second copy of the rule is how the two drift.
 */
export const specOwnQuote = (intent: ColoringPageSpec): string =>
	intent.footerItem?.label ||
	normalizeSpecTitle(intent.title, DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle);

/**
 * Studio text describing a persisted page, or `null` when the page prints nothing to describe.
 *
 * `MeechieStudioTextOutputSchema` requires at least two `pageItems`, so a spec with none — exactly
 * the shape a wig try-on page saves, and what a toolkit quote page degrades to when its verdict
 * cannot yield printable lines — cannot be described without inventing them. This used to return
 * the demo seed's THE RENT / THE DOPEMAN / WHAT IT COST for that case: words that were never on the
 * page and were never Meechie's.
 *
 * Callers guarded the *writes* against that fabrication and left it in the state, so it still
 * reached the paper as the page's list and still enabled Save to Vault on a page that had nothing
 * to save. Returning `null` deletes the invention itself rather than adding a third guard against
 * it — a page with no printed items has no studio text, and every consumer already handles that.
 */
const buildStudioTextFromSpec = (input: {
	intent: ColoringPageSpec;
	studioText?: MeechieStudioTextOutput;
}): MeechieStudioTextOutput | null => {
	if (input.studioText) {
		return input.studioText;
	}
	if (input.intent.items.length === 0) {
		return null;
	}
	const pageTitle = normalizeSpecTitle(input.intent.title, DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle);
	return {
		verdict: pageTitle,
		quote: specOwnQuote(input.intent),
		pageTitle,
		pageItems: input.intent.items.map((item) => ({
			number: item.number,
			label: normalizeSpecLabel(item.label, DEFAULT_STUDIO_TEXT_OUTPUT.pageItems[0].label)
		})),
		qualityState: 'ready'
	};
};

export const buildStudioTextFromDraftRecord = (
	draft: DraftRecord
): MeechieStudioTextOutput | null =>
	buildStudioTextFromSpec({
		intent: draft.intent,
		studioText: draft.studioText
	});

export const buildStudioTextFromCreationRecord = (
	creation: CreationRecord
): MeechieStudioTextOutput | null =>
	buildStudioTextFromSpec({
		intent: creation.intent,
		studioText: creation.studioText
	});

/**
 * Whether a style hint asks for dense decoration.
 *
 * Exported because the studio has to answer "did the thing that drives density change?" before it
 * decides whether a reopened page keeps its saved value, and answering that with a second copy of
 * this rule is how the two drift apart. Note that the hint carries the voice as well as the theme,
 * so the intensity `receipts_out` matches it on its own — surprising, long-standing, and the reason
 * the question has to be asked against this predicate rather than against the theme or the whole
 * hint string.
 */
export const derivesDenseDecorations = (styleHint: string): boolean =>
	styleHint.includes('receipt');

export const buildColoringPageSpecFromMeechieText = (input: {
	output: Pick<
		MeechieStudioTextOutput,
		'pageTitle' | 'pageItems' | 'quote' | 'verdict' | 'qualityState'
	>;
	pageSize: ColoringPageSpec['pageSize'];
	border: ColoringPageSpec['border'];
	styleHint: string;
	dedication?: string;
	/**
	 * The layout to rebuild in. Defaults to `'list'`, which is what the studio has always
	 * produced, so studio behaviour is unchanged.
	 *
	 * It exists for pages the studio did not author. A page saved from the Meechie tools hub can
	 * be `title_only` — the quote *is* the page — and its stored `studioText.pageItems` are a
	 * faithful record of the verdict rather than lines the page prints. Rebuilding such a page at
	 * `'list'` would silently reprint it as a numbered list the next time a setting changed,
	 * spending a generation on the wrong layout.
	 */
	listMode?: ColoringPageSpec['listMode'];
	/**
	 * Whether to print the repeated-title footer. Defaults to true, which is what the studio has
	 * always done.
	 *
	 * A list page saved from the Meechie tools hub carries no footer — the prompt assembler renders
	 * one as a second exact headline line, so adding it on rebuild gives the reopened page a
	 * duplicate of its own title.
	 */
	includeFooter?: boolean;
	/**
	 * The presentation of the page being rebuilt, when there is one to carry forward.
	 *
	 * Same reason as `listMode` and `includeFooter`, and the same omission they each were: a page
	 * saved by the tools hub is centered, large, stroke 9, loose gutter, 35 whitespace. Rebuilding
	 * dropped all of that back to the studio's own defaults, so changing something as narrow as page
	 * size silently returned a visibly different layout — left-aligned, small, stroke 6. Layout,
	 * footer and presentation are the same question: is this still the page that was reopened?
	 */
	presentation?: Partial<
		Pick<
			ColoringPageSpec,
			| 'alignment'
			| 'numberAlignment'
			| 'listGutter'
			| 'whitespaceScale'
			| 'textSize'
			| 'fontStyle'
			| 'textStrokeWidth'
			| 'colorMode'
			| 'decorations'
			| 'illustrations'
			| 'shading'
			| 'borderThickness'
			| 'variations'
		>
	>;
}): ColoringPageSpec => ({
	title: normalizeSpecTitle(input.output.pageTitle, DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle),
	// `title_only` forbids both items and a footer item, so a quote page carries neither.
	items:
		input.listMode === 'title_only'
			? []
			: input.output.pageItems.map((item) => ({
					number: item.number,
					label: normalizeSpecLabel(item.label, DEFAULT_STUDIO_TEXT_OUTPUT.pageItems[0].label)
				})),
	...(input.listMode === 'title_only' || input.includeFooter === false
		? {}
		: {
				footerItem: {
					number: 97,
					label: normalizeSpecLabel(
						input.output.pageTitle,
						DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle
					)
				}
			}),
	listMode: input.listMode ?? 'list',
	alignment: input.presentation?.alignment ?? 'left',
	numberAlignment: input.presentation?.numberAlignment ?? 'strict',
	listGutter: input.presentation?.listGutter ?? 'normal',
	whitespaceScale: input.presentation?.whitespaceScale ?? 50,
	textSize: input.presentation?.textSize ?? 'small',
	fontStyle: input.presentation?.fontStyle ?? 'rounded',
	textStrokeWidth: input.presentation?.textStrokeWidth ?? 6,
	colorMode: input.presentation?.colorMode ?? 'black_and_white_only',
	// Carried forward like the rest of the presentation, but the caller drops it when the reader
	// picks a theme, because this one is *derived* from the theme rather than chosen directly.
	// Preserving it unconditionally made the Theme control contradict itself; recomputing it
	// unconditionally was no better, since a restored page's theme is not restored with it, so a
	// page-size change alone turned a dense page minimal. Provenance lives with the caller, which is
	// the only side that knows whether a theme was actually selected.
	decorations:
		input.presentation?.decorations ?? (derivesDenseDecorations(input.styleHint) ? 'dense' : 'minimal'),
	illustrations: input.presentation?.illustrations ?? 'simple',
	shading: input.presentation?.shading ?? 'none',
	border: input.border,
	borderThickness: input.presentation?.borderThickness ?? 8,
	variations: input.presentation?.variations ?? 1,
	outputFormat: 'pdf',
	pageSize: input.pageSize,
	dedication: input.dedication
});
