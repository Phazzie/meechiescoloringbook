// Purpose: Centralize Meechie studio modes, control metadata, and spec mapping.
// Why: Keep UI pricing/budget labels and page text generation deterministic.
// Info flow: Metadata + AI text output -> UI controls -> ColoringPageSpec.
import { MAX_LABEL_LENGTH, type ColoringPageSpec } from '../../../contracts/spec-validation.contract';
import type { CreationRecord, DraftRecord } from '../../../contracts/creation-store.contract';
import type { MeechieStudioTextAction, MeechieStudioTextOutput } from '../../../contracts/meechie-studio-text.contract';
import type { MeechieToolInput } from '../../../contracts/meechie-tool.contract';

export const DEFAULT_REVISION_BUDGET = 3;

// Placeholder shown on the page preview before anything is generated.
// Drawn from canon voice-pack lines (ids: the-door, my-shadow,
// area-of-control) so the preview never shows wording that is not in the
// canon. `the-door` is the one canon line with no profanity in it, which is
// what makes it usable as visible placeholder copy.
// A test in tests/unit/meechie-studio.test.ts fails if this quote ever drifts
// out of the voice pack.
export const DEFAULT_STUDIO_TEXT_OUTPUT: MeechieStudioTextOutput = {
	verdict: 'Meechie already clocked it.',
	quote:
		'Don\'t open the door. Not even a little bit. Cause if you open the door even a little bit, I\'m coming through.',
	pageTitle: 'NOT EVEN A LITTLE BIT',
	pageItems: [
		{ number: 1, label: 'DO NOT OPEN THE DOOR' },
		{ number: 2, label: 'RIGHT HERE IN MY SHADOW' },
		{ number: 3, label: 'AN AREA OF CONTROL' }
	],
	qualityState: 'ready',
	revisionNote: 'Canon preview line. Generate to get yours.'
};

export type CostClass = 'free' | 'paid' | 'unclassified';

type StudioActionDefinition = {
	id: string;
	label: string;
	costClass: CostClass;
	countsAgainstRevisionBudget: boolean;
	aiAction?: MeechieStudioTextAction;
};

export const studioActions = [
	{
		id: 'generate_text',
		label: 'Generate Verdict',
		costClass: 'unclassified',
		countsAgainstRevisionBudget: true,
		aiAction: 'generate'
	},
	{
		id: 'regenerate',
		label: 'Regenerate',
		costClass: 'unclassified',
		countsAgainstRevisionBudget: true,
		aiAction: 'regenerate'
	},
	{
		id: 'make_prettier',
		label: 'Make Prettier',
		costClass: 'unclassified',
		countsAgainstRevisionBudget: true,
		aiAction: 'make_prettier'
	},
	{
		id: 'make_meaner',
		label: 'Make Meaner',
		costClass: 'unclassified',
		countsAgainstRevisionBudget: true,
		aiAction: 'make_meaner'
	},
	{
		id: 'make_more_specific',
		label: 'More Specific',
		costClass: 'unclassified',
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
	const weekly = [pool[offset % pool.length], pool[(offset + 1) % pool.length]];
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

export const canRunStudioAction = (
	actionId: StudioActionId,
	state: { remainingBudget: number; isRunning: boolean }
): boolean => {
	const action = getStudioAction(actionId);
	if (state.isRunning && action.countsAgainstRevisionBudget) {
		return false;
	}
	if (action.countsAgainstRevisionBudget && state.remainingBudget <= 0) {
		return false;
	}
	return true;
};

const normalizeSpecLabel = (value: string, fallback: string): string => {
	const normalized = value
		.normalize('NFKD')
		.replace(/&/g, ' ')
		.replace(/[^A-Za-z0-9 .,!?'":;\-()]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();
	const safe = normalized.length > 0 ? normalized : fallback;
	return safe.slice(0, MAX_LABEL_LENGTH).trim();
};

const buildStudioTextFromSpec = (input: {
	intent: ColoringPageSpec;
	quoteFallback?: string;
	studioText?: MeechieStudioTextOutput;
}): MeechieStudioTextOutput => {
	if (input.studioText) {
		return input.studioText;
	}
	const pageTitle = normalizeSpecLabel(input.intent.title, DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle);
	return {
		verdict: pageTitle,
		quote: input.quoteFallback?.trim() || input.intent.footerItem?.label || pageTitle,
		pageTitle,
		pageItems:
			input.intent.items.length > 0
				? input.intent.items.map((item) => ({
						number: item.number,
						label: normalizeSpecLabel(item.label, DEFAULT_STUDIO_TEXT_OUTPUT.pageItems[0].label)
					}))
				: DEFAULT_STUDIO_TEXT_OUTPUT.pageItems,
		qualityState: 'ready'
	};
};

export const buildStudioTextFromDraftRecord = (draft: DraftRecord): MeechieStudioTextOutput =>
	buildStudioTextFromSpec({
		intent: draft.intent,
		studioText: draft.studioText
	});

export const buildStudioTextFromCreationRecord = (
	creation: CreationRecord
): MeechieStudioTextOutput =>
	buildStudioTextFromSpec({
		intent: creation.intent,
		quoteFallback: creation.assembledPrompt,
		studioText: creation.studioText
	});

export const buildColoringPageSpecFromMeechieText = (input: {
	output: Pick<
		MeechieStudioTextOutput,
		'pageTitle' | 'pageItems' | 'quote' | 'verdict' | 'qualityState'
	>;
	pageSize: ColoringPageSpec['pageSize'];
	border: ColoringPageSpec['border'];
	styleHint: string;
	dedication?: string;
}): ColoringPageSpec => ({
	title: normalizeSpecLabel(input.output.pageTitle, DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle),
	items: input.output.pageItems.map((item) => ({
		number: item.number,
		label: normalizeSpecLabel(item.label, DEFAULT_STUDIO_TEXT_OUTPUT.pageItems[0].label)
	})),
	footerItem: {
		number: 97,
		label: normalizeSpecLabel(input.output.pageTitle, DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle)
	},
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: input.styleHint.includes('receipt') ? 'dense' : 'minimal',
	illustrations: 'simple',
	shading: 'none',
	border: input.border,
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: input.pageSize,
	dedication: input.dedication
});
