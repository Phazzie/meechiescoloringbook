// Purpose: Svelte 5 runes state class encapsulating all Meechie Studio page logic.
// Why: Extracts the 690-line script from +page.svelte into a testable, self-contained
//      state module; the page component becomes a thin lifecycle wrapper.
// Info flow: User actions -> StudioState methods -> reactive $state updates -> component props.
import { authContextAdapter } from '$lib/adapters/auth-context-seam';
import { appOriginSeam } from '$lib/adapters/app-origin-seam';
import { clockSeam } from '$lib/adapters/clock-seam';
import { creationStoreAdapter } from '$lib/adapters/creation-store-seam';
import { outputPackagingAdapter } from '$lib/adapters/output-packaging-seam';
import { pageVisibilitySeam } from '$lib/adapters/page-visibility-seam';
import { sessionAdapter } from '$lib/adapters/session-seam';
import { specValidationAdapter } from '$lib/adapters/spec-validation-seam';
import {
	DEFAULT_REVISION_BUDGET,
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText,
	derivesDenseDecorations,
	buildStudioTextFromCreationRecord,
	buildStudioTextFromDraftRecord,
	specOwnQuote,
	canRunStudioAction,
	consumeStudioActionBudget,
	getStudioTextAction,
	getMonthlyMode,
	getWeeklyModes,
	studioThemes,
	type StudioTextActionId
} from '$lib/core/meechie-studio';
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import { compactColoringPageTitle } from '$lib/core/coloring-page-title';
import {
	GENERATED_IMAGE_MIME_TYPES,
	generatedImageDataUrl
} from '$lib/core/generated-image-preview';
import {
	describeOriginalImageExport,
	describePackagedExports,
	summarisePageExportFailures,
	type PageExport,
	type PageExportAttempt
} from '$lib/core/page-exports';
import {
	VAULT_CAPACITY,
	VAULT_PREVIEW_COUNT,
	buildVaultEntries,
	buildVaultEntry,
	restoreCreationImages,
	sortVaultCreations
} from '$lib/core/vault-gallery';
import { GenerateResultSchema } from '../../contracts/generate.contract';
import { WigTryOnResultSchema } from '../../contracts/wig-try-on.contract';
import {
	MeechieStudioTextResultSchema,
	type MeechieStudioTextOutput,
	type MeechieStudioVoiceSettings
} from '$lib/seams/meechie-studio-text-seam/contract';
import type { CreationOwner, CreationRecord } from '$lib/seams/creation-store-seam/contract';
import type { DriftDetectionOutput, Violation } from '../../contracts/drift-detection.contract';
import type { GeneratedImage } from '../../contracts/image-generation.contract';
import type { PackagedFile } from '$lib/seams/output-packaging-seam/contract';
import type {
	ColoringPageSpec,
	SpecValidationOutput
} from '../../contracts/spec-validation.contract';
import type { AppOriginSeam } from '$lib/seams/app-origin-seam/contract';
import { nextUtcDayBoundary, type ClockSeam } from '$lib/seams/clock-seam/contract';
import type { PageVisibilitySeam } from '$lib/seams/page-visibility-seam/contract';
import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

import {
	buildStyleHint,
	DEFAULT_STYLE_SELECTION,
	themeForSelection,
	type StyleSelection,
	type StyleWig
} from '$lib/core/page-style';

type PageSize = ColoringPageSpec['pageSize'];
type BorderChoice = ColoringPageSpec['border'];

/**
 * What caused a spec rebuild: the reader picking a theme, or anything else.
 *
 * This is not the whole answer to "should derived presentation be recomputed?" — the style hint
 * carries the voice as well as the theme, so `applyTextToSpec` also compares the hint itself. What
 * this flag adds is the one case no comparison can see: a click on the theme chip that is already
 * active leaves every value identical, and is still the reader asking for that theme.
 */
export type SettingChangeSource = 'theme' | 'setting';

/**
 * What a rebuild says when it failed for a reason it cannot name — a thrown value that is not an
 * `Error`, so there is no message to pass on.
 *
 * Named rather than written twice. The two rebuild callers report it on different lines of the page
 * (Page Controls and the try-on studio), which is precisely the arrangement where two copies of one
 * sentence drift apart and the reader is told two different things about the same failure.
 */
const UNCHECKED_SETTINGS_MESSAGE = 'Page settings could not be checked.';

/**
 * A spec with the reader's current dedication on it, and no `dedication` key at all when there is
 * none.
 *
 * Spreading `{ dedication: undefined }` would leave the key present with an undefined value, which
 * survives `$state.snapshot` and reaches the storage seam. `DedicationSchema` is `.optional()`, so
 * that parses — and then the record carries a field it does not have, which is the kind of small
 * untruth this whole change is about. Deleting the key is the difference between "no dedication"
 * and "a dedication that is nothing".
 */
const withDedication = (
	spec: ColoringPageSpec,
	dedication: string | undefined
): ColoringPageSpec => {
	if (dedication !== undefined) {
		return { ...spec, dedication };
	}
	// `delete` on a copy rather than a destructured rest. Naming a binding only to discard it is
	// what SonarCloud flagged here, and the rule is right that the name carries no information —
	// the sentence above already says why the key goes.
	const withoutDedication = { ...spec };
	delete withoutDedication.dedication;
	return withoutDedication;
};

/**
 * One try-on result: the wig it was made for, and the portrait produced.
 *
 * The whole wig is held rather than its id, so the compare strip can both label a portrait and
 * put the reader back on that wig without a catalog lookup — and so a portrait is always labelled
 * with the wig it was actually made for, whatever the catalog does afterwards.
 */
export type TryOnPortrait = {
	wig: Wig;
	portraitUrl: string;
};

const DRAFT_SAVE_DEBOUNCE_MS = 300;

/**
 * The name downloads fall back to before a page has been packaged.
 *
 * Only reachable for the provider's own image, which the export row can describe the moment the
 * page lands — a beat before packaging finishes and names it after the page.
 */
const DEFAULT_PAGE_FILE_BASE_NAME = 'meechie-coloring-page';

/**
 * The variants every finished page is packaged into, in the order they appear in the export row.
 *
 * Matches what the tools hub and the mode routes already build, so the front door stops being the
 * one page-making surface in the app that could print a page but not post it. `chat` is deliberately
 * not requested: each extra variant is another full canvas rasterisation per generation, and a third
 * one buys a size the square already covers.
 */
const STUDIO_EXPORT_VARIANTS = ['print', 'square'] as const;

type DraftSeedTextSignature = {
	title: string;
	itemLabels: readonly string[];
	footerLabel?: string;
};

const DRAFT_SEED_TEXT_SIGNATURES: readonly DraftSeedTextSignature[] = [
	{
		title: DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle,
		itemLabels: DEFAULT_STUDIO_TEXT_OUTPUT.pageItems.map((item) => item.label),
		footerLabel: DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle
	},
	{
		title: "I DON'T ACT",
		itemLabels: ['RUN THE PLACE', 'DO NOT OPEN THE DOOR', 'LOWER MY VOICE'],
		footerLabel: "I DON'T ACT"
	},
	// Shipped from the root commit 4c5660f (2026-05-10) until 05dede1 (2026-08-24)
	// replaced it with the "I DON'T ACT" seed. Drafts saved in that window still carry
	// this text, and it is seed text, not user work.
	{
		title: 'IN THIS ECONOMY',
		itemLabels: ['STAY PRETTY TOMORROW', 'CLOSE THE DOOR', 'LET THE DRAFT WORK'],
		footerLabel: 'IN THIS ECONOMY'
	}
];

const matchesDraftSeedText = (
	intent: ColoringPageSpec,
	seed: DraftSeedTextSignature
): boolean =>
	intent.title === seed.title &&
	intent.items.length === seed.itemLabels.length &&
	intent.items.every((item, index) => item.label === seed.itemLabels[index]) &&
	intent.footerItem?.label === seed.footerLabel;

const isKnownDraftSeed = (intent: ColoringPageSpec): boolean =>
	DRAFT_SEED_TEXT_SIGNATURES.some((seed) => matchesDraftSeedText(intent, seed));

export class StudioState {
	// Computed per-instance so week/month rotation stays fresh on each page mount.
	readonly weeklyModes = getWeeklyModes();
	readonly monthlyModeId = getMonthlyMode().id;

	// --- Reactive state (template-bound) ---
	activeModeId = $state(this.weeklyModes[0].id);
	// The studio's starting style and `DEFAULT_STYLE_SELECTION` were the same three values written
	// out twice. Spread rather than shared, so one instance's voice is not another's.
	selectedThemeId = $state(DEFAULT_STYLE_SELECTION.themeId);
	evidence = $state('');
	dedication = $state('');
	voice = $state<MeechieStudioVoiceSettings>({ ...DEFAULT_STYLE_SELECTION.voice });
	pageSize = $state<PageSize>('US_Letter');
	border = $state<BorderChoice>('decorative');
	glitter = $state(DEFAULT_STYLE_SELECTION.glitter);
	revisionBudget = $state(DEFAULT_REVISION_BUDGET);
	textOutput = $state<MeechieStudioTextOutput | null>(null);
	textError = $state('');
	generationError = $state('');
	draftSaveError = $state('');
	/**
	 * A Page Controls change that could not be applied.
	 *
	 * Its own field, because it used to be written to `draftSaveError` — rendered in the *evidence*
	 * panel, prefixed "Draft not saved:". A theme that failed to apply was therefore reported as a
	 * draft problem, on a different panel, while the control the reader had just moved said nothing.
	 */
	settingsError = $state('');
	/**
	 * What the spec check found wrong after a Page Controls change, in the reader's words.
	 *
	 * `settingsError` above covers only the case where the check could not be *run* — an adapter
	 * rejection, which is the rare one. An ordinary contract failure resolves normally with
	 * `{ ok: false, issues }`, and `applyTextToSpec` awaited that result and dropped the boolean, so
	 * the common failure went on appearing solely in System Trace: a Page Controls change reported
	 * in a panel about the provider, which is precisely what this run took `draftSaveError` out of.
	 *
	 * Written only by `syncSpecFromCurrentText`, the panel's own handler, and cleared at the top of
	 * every one of its runs. Mirroring `validationIssues` wholesale would have parked a generation's
	 * or a reopen's findings under the settings panel, blaming the controls for something that
	 * happened before the reader touched them.
	 *
	 * That sentence was false when it was written, which is why the rebuild is now split. The wig
	 * selector and the try-on page generator both called `syncSpecFromCurrentText`, so both wrote
	 * here; the try-on path in particular left a finished, valid page reporting a failure about the
	 * intermediate spec it had already thrown away. They call `rebuildSpecFromCurrentText` instead,
	 * and the claim holds by construction rather than by everyone remembering it.
	 */
	settingsIssues = $state<string[]>([]);
	/**
	 * The wig provenance of a reopened page, or `null` when the page on the paper is not one.
	 *
	 * Three states, and the wrapper is what makes the middle one expressible:
	 *   `null`            — no restored page; the hint takes the live wig.
	 *   `{ value: undefined }` — a restored page whose stored style had *no* wig.
	 *   `{ value: wig }`  — a restored page whose stored style had that wig.
	 *
	 * A bare `StyleWig | undefined` collapsed the first two, so a reader who had any wig selected
	 * and then reopened a page saved without one rebuilt that page's hint with the unrelated live
	 * wig — `loadCreation` does not clear `selectedWig`. Cleared by `resetGeneratedPage` and by the
	 * reader picking a wig, which is the moment the live selection becomes theirs again.
	 *
	 * Not `$state`: nothing renders it, and it is read only while composing the hint.
	 */
	private restoredStyleWig: { value: StyleWig | undefined } | null = null;
	/**
	 * The style that produced the page currently on the paper.
	 *
	 * Captured where the artifact is — beside `assembledPrompt` and `images` — rather than read off
	 * the live controls when the reader saves. Generating a page and *then* moving a control leaves
	 * the picture and the prompt describing the old style while the controls describe the new one;
	 * saving the controls would have written a record whose stored style never made its own image,
	 * which is the silent-restyling defect this run exists to remove, one step further along.
	 *
	 * `undefined` means "no page, or a page whose style is not on file" — see `styleSelectionUnknown`.
	 *
	 * `$state` because `styleSelectionUnknown` and `pageGlitter` are derived from it. Nothing renders
	 * it directly, and it was a plain field until those two started reading it as their only
	 * non-constant input: a `$derived` over an unreactive field simply never recomputes, so the panel
	 * kept whatever it had said first. It read `assembledPrompt` before, which is `$state`, and that
	 * is the only reason the plain field appeared to work.
	 */
	private generatedStyleSelection = $state<StyleSelection | undefined>(undefined);
	/**
	 * The spec the page currently on the paper was actually built from.
	 *
	 * The same rule as `generatedStyleSelection`, applied to the record's `intent`. That field *is*
	 * persisted — it is where page size and border always came back from, which is why they were
	 * never part of the missing-style problem — but it is persisted from the **live** spec at save
	 * time, and `applyTextToSpec` rebuilds that spec from the live controls on every setting change.
	 * So generating a page, moving a control and then saving wrote a record whose stored spec never
	 * produced its own image, prompt or downloads.
	 *
	 * The whole spec rather than the two paper fields, which is where this started. `decorations` is
	 * *derived from the style hint* — the very thing this change made storable — so switching from a
	 * dense theme to a minimal one after generating left a record whose `styleSelection` said dense
	 * and whose `intent.decorations` said minimal, about one picture. Snapshotting two fields fixed
	 * the two I had thought of; snapshotting the spec fixes the field, its whole `presentation`
	 * group, and whatever is added to that group next.
	 *
	 * Title, items and the footer cannot drift into it: they are built from `textOutput`, and every
	 * path that replaces `textOutput` calls `resetGeneratedPage`, which clears this. The one field
	 * deliberately NOT taken from here is `dedication` — see `saveToVault`.
	 *
	 * Known for a reopened record too, including one written before `styleSelection` existed — the
	 * spec is the record, so unlike the style there is no unknown case to report.
	 *
	 * `undefined` means there is no page on the paper. `$state` for the same reason as
	 * `generatedStyleSelection` above: it is what `styleSelectionUnknown` and `pageGlitter` are
	 * derived from.
	 */
	private generatedSpec = $state<ColoringPageSpec | undefined>(undefined);
	isTextWorking = $state(false);
	isGenerating = $state(false);
	copyStatus = $state('');
	vaultStatus = $state('');
	validationIssues = $state<SpecValidationOutput['issues']>([]);
	assembledPrompt = $state('');
	/**
	 * True when there is a page on the paper and its own style is not on file.
	 *
	 * Derived rather than assigned, from the two facts that decide it: `generatedSpec` is set
	 * exactly when there is an artifact on screen, and `generatedStyleSelection` is set exactly when
	 * that artifact's style is known. A separate flag had to be written correctly at four sites, and
	 * a fifth would have been added silently.
	 *
	 * A record written before styles were stored restores a spec and no selection, so the panel says
	 * the page's style is not on file and leaves the reader's own controls alone.
	 *
	 * This asked `assembledPrompt !== ''` until a review pointed at the gap: the prompt is assigned
	 * *before* the check for a response that came back with no picture, deliberately, so System
	 * Trace still shows what was asked for. So a generation that produced nothing looked like an
	 * artifact.
	 *
	 * It then read `generatedSpec !== undefined && !generatedStyleSelection`, which made one field
	 * answer two different questions: "is there a picture whose spec must not be overwritten?" and
	 * "did the record on screen store a style?". Those come apart on a record saved without ever
	 * generating an image, and a review found them apart — see `restoredStyleUnknown` and
	 * `loadCreation`. This is now the second question only, which is the one the panel asks.
	 */
	/**
	 * The page on the paper was restored from a record that stored no style of its own.
	 *
	 * Its own field because it is a fact about the *restore*, not about an artifact. Only
	 * `loadCreation` sets it and only `resetGeneratedPage` clears it, so every path that replaces
	 * the paper clears it exactly once.
	 */
	private restoredStyleUnknown = $state(false);
	styleSelectionUnknown = $derived(this.restoredStyleUnknown);
	/**
	 * The glitter the paper on screen should be wearing — the page's, not the control's.
	 *
	 * The preview draws a sparkle overlay on the paper, and it was bound straight to the live
	 * Glitter checkbox. So with a generated page on screen, toggling Glitter changed how that page
	 * visibly looked — while the panel one panel over promised, in a sentence added by this same
	 * change, that the page keeps the look it was made with until you make it again. One of the two
	 * had to go, and it was not going to be the promise: the whole point of storing the style is
	 * that a finished page stops answering to the controls.
	 *
	 * With no page on the paper this still follows the checkbox, because there the overlay is a
	 * preview of the setting rather than a claim about an artifact — that is the one moment it is
	 * honest for it to move.
	 *
	 * A page whose style is not on file shows no overlay. It is the only value that is not a guess:
	 * asserting the live checkbox over somebody else's picture is the exact false provenance this
	 * run removed everywhere else, and the panel is already telling the reader why.
	 */
	pageGlitter = $derived(
		this.generatedSpec === undefined
			? this.glitter
			: (this.generatedStyleSelection?.glitter ?? false)
	);
	revisedPrompt = $state('');
	violations = $state<Violation[]>([]);
	recommendedFixes = $state<DriftDetectionOutput['recommendedFixes']>([]);
	images = $state<GeneratedImage[]>([]);
	/**
	 * Every call made to the packaging seam for the page on the paper: the variant asked for, the
	 * files that came back, and the error if it could not be built.
	 *
	 * The stored form is the *attempts* rather than a flat file list because the variant is the one
	 * thing the export row needs and a filename cannot be trusted to carry. Everything the UI reads
	 * — the files, the described downloads, the failure sentence — is derived from this, so there is
	 * one thing to keep correct instead of three that can disagree.
	 */
	packageAttempts = $state<PageExportAttempt[]>([]);
	/**
	 * The base name every download for this page shares, so a printable PDF, its share image and the
	 * provider's own bytes arrive in the reader's Downloads folder named after the same page. Empty
	 * until a page has been packaged.
	 */
	pageFileBaseName = $state('');
	creations = $state<CreationRecord[]>([]);
	isSaving = $state(false);

	// --- Quote Vault state ---
	vaultQuery = $state('');
	vaultShowAll = $state(false);
	vaultError = $state('');
	// True only when the last vault *read* failed, so the UI can distinguish "your pages are still
	// there, we could not see them" from any other error that happens to leave the list empty.
	vaultReadFailed = $state(false);
	// Delete is two-step and reversible: the first click arms `pendingDeleteId`, the second
	// removes the record but keeps it in `undoableDeletion` so one click puts it back. A saved
	// page costs a paid generation, so a single mis-tap must never be able to destroy one.
	pendingDeleteId = $state<string | null>(null);
	undoableDeletion = $state<CreationRecord | null>(null);
	// The clock behind the "Saved today / 3 days ago" labels. `AGENTS.md` classifies clock/time as
	// a seam, so both the reads and the day-boundary timer cross `ClockSeam` rather than calling
	// `Date.now()` or `setTimeout` here. Injectable so a test drives the rollover instead of
	// waiting for real midnight. Declared before `nowMs` so the field initializer below can use it.
	clock: ClockSeam = clockSeam;
	// Clock reading behind the labels. Held as state and refreshed at each day boundary and on each
	// vault reload, so the labels stay a pure function of an explicit instant rather than
	// re-reading the clock inside a $derived on every keystroke.
	nowMs = $state(this.clock.now());
	// Reads the origin the app is served from, used to decide whether a stored absolute image URL
	// is same-origin and therefore loadable under the app's `img-src 'self'` CSP. Behind a seam for
	// the same reason as the clock: reading `location` here would be an unseamed browser
	// integration, and the same-origin decision could not be driven from a test.
	origin: AppOriginSeam = appOriginSeam;
	// Tells the studio when a backgrounded tab comes back. Behind a seam for the same reason as the
	// clock: reading `document.visibilityState` and subscribing to `visibilitychange` here would be
	// an unseamed browser integration, reachable from a test only by dispatching a real DOM event.
	visibility: PageVisibilitySeam = pageVisibilitySeam;
	appOrigin = $state(this.origin.getOrigin());

	// --- Wig try-on state ---
	selectedWig = $state<Wig | null>(null);
	// Derived, not stored. Trying a wig on now needs the whole wig — the portrait is filed under it
	// and labelled with its name — so a separately assigned id would be a second source of truth
	// for "which wig is on screen", free to disagree with the first.
	selectedWigId = $derived(this.selectedWig?.id ?? null);
	selfieBase64 = $state('');
	selfieMimeType = $state<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
	isTryingOn = $state(false);
	tryOnError = $state('');
	/**
	 * Every portrait made from the current selfie, keyed by the wig it was made for.
	 *
	 * This was one string, so trying on a second wig destroyed the first portrait — in a feature
	 * whose entire purpose is deciding between wigs, and at the price of one AI image generation
	 * per look. Keyed by wig, coming back to a wig shows what it looked like instead of a blank.
	 *
	 * Correctness rides on each entry naming its wig and the list being tied to one selfie: a
	 * portrait of a face the reader has since replaced, shown under a new wig, would be worse than
	 * losing it. `setSelfieForTryOn` therefore drops the whole list, not one entry.
	 *
	 * An array rather than a map because the order is the order they were tried, which is the order
	 * the compare strip shows — and re-trying a wig replaces it in place, so the strip does not
	 * reshuffle under the reader's finger.
	 */
	tryOnPortraits = $state<TryOnPortrait[]>([]);

	// spec is initialized from literal values to avoid capturing $state references.
	// It is updated explicitly via applyTextToSpec() whenever page settings change.
	spec = $state<ColoringPageSpec>(
		buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: studioThemes[0].styleHint
		})
	);

	// --- Derived state ---
	activeMode = $derived(
		this.weeklyModes.find((m) => m.id === this.activeModeId) ?? this.weeklyModes[0]
	);
	activeTheme = $derived(
		studioThemes.find((t) => t.id === this.selectedThemeId) ?? studioThemes[0]
	);
	previewOutput = $derived(this.textOutput);
	canGenerateText = $derived(
		canRunStudioAction('generate_text', {
			remainingBudget: this.revisionBudget,
			isRunning: this.isTextWorking
		})
	);
	canRegenerateText = $derived(
		!!this.textOutput &&
			canRunStudioAction('regenerate', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakePrettier = $derived(
		!!this.textOutput &&
			canRunStudioAction('make_prettier', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakeMeaner = $derived(
		!!this.textOutput &&
			canRunStudioAction('make_meaner', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakeMoreSpecific = $derived(
		!!this.textOutput &&
			canRunStudioAction('make_more_specific', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	// `?? ''` rather than dropping the entry: this array is indexed in parallel with `images`, so
	// an unrepresentable image has to hold its slot instead of shifting every later preview onto
	// the wrong image.
	imagePreviews = $derived(
		this.images.map((image) => generatedImageDataUrl(image) ?? '')
	);
	/** The bytes of every file packaged for the page on the paper. */
	packagedFiles = $derived<PackagedFile[]>(
		this.packageAttempts.flatMap((attempt) => attempt.files)
	);
	/**
	 * The export row: each packaged file, then the provider's own image, every one of them carrying
	 * what it is, what it is for and how big it is.
	 *
	 * The original comes last and is derived from `images` rather than stored, so it appears and
	 * disappears with the page it belongs to and can never be left behind by a reset.
	 */
	pageExports = $derived.by((): PageExport[] => {
		// No page size passed: each attempt carries the one it was packaged for, so the row cannot
		// describe a file as paper it was not made on.
		const packaged = describePackagedExports(this.packageAttempts);
		const original = describeOriginalImageExport(
			this.images[0],
			this.pageFileBaseName || DEFAULT_PAGE_FILE_BASE_NAME
		);
		return original ? [...packaged, original] : packaged;
	});
	/**
	 * What could not be packaged, phrased so it can never be read as "the generation failed".
	 *
	 * A separate field from `generationError` on purpose. Both used to be written to the same string,
	 * so a page that generated perfectly and then failed to become a PDF showed the same red line as
	 * a page that never generated — above the finished page itself.
	 */
	exportError = $derived(summarisePageExportFailures(this.packageAttempts));
	canTryOn = $derived(!!this.selectedWigId && !!this.selfieBase64 && !this.isTryingOn);
	// The portrait on screen is whichever belongs to the wig on screen. Selecting a wig that was
	// already tried on brings its portrait back rather than showing an empty result panel.
	tryOnPortraitUrl = $derived(
		this.tryOnPortraits.find((portrait) => portrait.wig.id === this.selectedWigId)
			?.portraitUrl ?? ''
	);
	// Only worth showing once there is a decision to make, which is what a second portrait is.
	/**
	 * Making a page needs a portrait that is not about to be replaced.
	 *
	 * Trying the *same* wig on again keeps the old portrait on screen while the new one is styled,
	 * and replacing it changes neither the selected wig nor the page token — so neither existing
	 * guard can see it. A page started in that window captures the old portrait URL and then keeps
	 * it, leaving the coloring page showing one look while the result panel shows another.
	 */
	canGenerateTryOnPage = $derived(
		!!this.tryOnPortraitUrl && !this.isGenerating && !this.isTryingOn
	);
	canCompareTryOns = $derived(this.tryOnPortraits.length > 1);
	// Words or a picture — either is a page worth keeping. Gating on the verdict alone is what left
	// a generated try-on page as the only thing in the app the vault would not take.
	canSaveToVault = $derived(
		!this.isSaving && (!!this.textOutput || this.images.length > 0)
	);

	// Every saved page the current search matches, pinned first then newest first. The list used
	// to be raw store order truncated to four, so a fifth save made the first one unreachable
	// even though the store keeps fifty.
	vaultEntries = $derived(
		buildVaultEntries(this.creations, {
			query: this.vaultQuery,
			nowMs: this.nowMs,
			appOrigin: this.appOrigin
		})
	);
	visibleVaultEntries = $derived(
		this.vaultShowAll
			? this.vaultEntries
			: this.vaultEntries.slice(0, VAULT_PREVIEW_COUNT)
	);
	hiddenVaultCount = $derived(
		Math.max(0, this.vaultEntries.length - this.visibleVaultEntries.length)
	);
	// Keyed off the match count, not off what is currently on screen: once expanded there is
	// nothing hidden, and the toggle still has to be there to collapse the list again. It stays
	// away entirely when everything fits in the preview.
	canToggleVaultShowAll = $derived(this.vaultEntries.length > VAULT_PREVIEW_COUNT);

	// The held record rendered the same way a saved row is, so the undo banner can offer a real
	// Download for it. Without this the page waiting in Undo has no download anywhere — it is out
	// of `creations`, so no row exists — and when the vault is full `undoDelete` tells the reader
	// to "download the page you want to keep before freeing a slot" while giving them no way to do
	// it. A reload then loses the only remaining copy. Telling someone to do something the screen
	// does not let them do is the same defect this whole rebuild started from.
	undoableDeletionEntry = $derived(
		this.undoableDeletion === null
			? null
			: buildVaultEntry(this.undoableDeletion, this.nowMs, this.appOrigin)
	);

	// --- Non-reactive implementation details ---
	owner: CreationOwner | null = null;
	/**
	 * True only while the spec's layout belongs to a page reopened from the vault.
	 *
	 * The studio always authors list pages; a page saved from the Meechie tools hub can be
	 * `title_only`. That layout must survive a settings change on the reopened page, but must not
	 * outlive it: carried into a brand-new verdict it would make
	 * `buildColoringPageSpecFromMeechieText` discard every new page item, spending revision budget
	 * and image quota on an incomplete page.
	 */
	private restoredPageLayout = false;

	/**
	 * Whether the page on the paper is a wig try-on portrait.
	 *
	 * A try-on page has no words on it — it is `title_only` with the wig's name and a picture — so
	 * whatever verdict happens to be on screen is not this page's text. It usually is not there at
	 * all, but a reader who generated a verdict first and then made a try-on page still has one, and
	 * saving that as the record's `studioText` claims words the page does not print: the vault would
	 * show that quote beside the portrait, and reopening would hand it back as the try-on page's own
	 * text and send it to the provider on the next revision.
	 *
	 * Refusing to restore text for a page that prints no items does not cover this. That rule asks
	 * "does this page have words of its own?", and here the words are perfectly real and perfectly
	 * present — they are just about a different page.
	 *
	 * Cleared in `resetGeneratedPage`, which every path replacing the paper goes through.
	 */
	private tryOnPageOnScreen = false;

	/**
	 * The title of the try-on page on the paper, kept so its shape can be restored after a rebuild.
	 *
	 * Every Page Control change runs `syncSpecFromCurrentText`, which rebuilds the spec from the
	 * verdict — or the demo seed — as a numbered list. On a try-on page that silently replaced the
	 * wig's title, items and layout while the portrait stayed on the paper, so changing the page
	 * size alone was enough to make the spec describe a different page than the one displayed, and
	 * saving stored the portrait under it.
	 */
	private tryOnPageTitle = '';

	/**
	 * The verdict on screen, but only when it is genuinely *this page's* words.
	 *
	 * Two things write studio text down — the vault and the draft — and both must answer the same
	 * question before they do. They asked it separately, and drifted: the vault learned to exclude a
	 * verdict that belongs to a different page, the draft did not, so a verdict → try-on → draft →
	 * refresh round trip put that verdict back as genuine and defeated the vault's guard from the
	 * other side. One accessor, so there is no second copy of the condition to forget.
	 *
	 * Excluded: any verdict at all while the paper is a wig portrait (`tryOnPageOnScreen`) — a
	 * portrait page prints no verdict words. Text invented by a restore needed a second exclusion
	 * here until `buildStudioTextFromSpec` stopped inventing it; there is now nothing to exclude,
	 * because a page with no printed items restores no text at all.
	 */
	private describingStudioText(): MeechieStudioTextOutput | undefined {
		if (!this.textOutput) return undefined;
		if (this.tryOnPageOnScreen) return undefined;
		return $state.snapshot(this.textOutput);
	}

	/** The title-only shape a try-on page always has: the wig's name, a picture, and nothing else. */
	private asTryOnPageSpec(spec: ColoringPageSpec): ColoringPageSpec {
		return {
			...spec,
			title: this.tryOnPageTitle,
			listMode: 'title_only',
			items: [],
			footerItem: undefined
		};
	}
	// Whether the last rebuild's style hint asked for dense decoration — the derivation's answer,
	// not its input. Seeded at restore time so the first unrelated setting change on a reopened page
	// compares equal and preserves what was restored.
	//
	// Comparing the whole hint string was the previous attempt and over-triggered: Rawness, Third
	// Person, Glitter and the wig all appear in the hint without governing density, so changing any
	// of them on a restored minimal page recomputed it — and with the default `receipts_out`
	// intensity the recomputation returns `dense`, so the page changed on a control that has nothing
	// to do with it.
	private lastDerivesDense: boolean | null = null;
	authContext: CreationRecord['authContext'] | null = null;
	// Incremented whenever the displayed page is replaced; async work captures it and drops its
	// result if the value moved on. Not $state: nothing renders it.
	pageLoadToken = 0;
	isBrowser = $state(false);
	private draftTimer: ReturnType<typeof setTimeout> | null = null;
	private stopVisibilityWatch: (() => void) | null = null;
	private cancelDayBoundaryRefresh: (() => void) | null = null;
	private isSavingDraft = false;
	private isDraftSavePending = false;

	// --- Private helpers ---
	private buildOwner(sessionId: string): CreationOwner {
		return { kind: 'anonymous', sessionId };
	}

	private generateCreationId(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `creation-${Date.now()}`;
	}

	private encodeBase64(value: string): string {
		const bytes = new TextEncoder().encode(value);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
	}

	/**
	 * The Page Controls, as the one value that composes the page's `Vibe:` line.
	 *
	 * The wig is read live and falls back to `restoredStyleWig`. A page can be made while a wig is
	 * selected, and the wig is then part of the hint that made it; reopening that page re-selects no
	 * wig, so without the fallback the first setting change would drop the wig out of the hint and
	 * quietly restyle a page the reader only asked to resize. `resetGeneratedPage` clears the
	 * fallback, so it can never outlive the page it was restored for.
	 */
	/**
	 * The wig the page on the paper is styled with, which is not always the one on screen.
	 *
	 * A restored page's stored provenance wins over the live carousel, *including* when that
	 * provenance is "no wig" — hence the wrapper object on `restoredStyleWig`, and hence the early
	 * return rather than a chain of conditionals: the two "undefined" answers here mean different
	 * things and reach the caller by different routes.
	 */
	private styleWig(): StyleWig | undefined {
		if (this.restoredStyleWig) return this.restoredStyleWig.value;
		if (!this.selectedWig) return undefined;
		return { name: this.selectedWig.name, style: this.selectedWig.style };
	}

	currentStyleSelection(): StyleSelection {
		const wig = this.styleWig();
		return {
			themeId: this.selectedThemeId,
			voice: $state.snapshot(this.voice),
			glitter: this.glitter,
			...(wig ? { wig } : {})
		};
	}

	private currentStyleHint(): string {
		return buildStyleHint(this.currentStyleSelection());
	}

	/**
	 * Put a stored selection back on the controls.
	 *
	 * Assigning the whole voice object rather than three fields keeps this in step with the contract
	 * shape: a voice value that gained a fourth setting would arrive here complete instead of being
	 * silently dropped by a three-field copy.
	 */
	private applyStyleSelection(selection: StyleSelection): void {
		// Resolved through the same fallback the encoder and the summary use, rather than assigned
		// raw. A stored id can name a theme a later release removed — the schema accepts it and
		// `themeForSelection` falls back — and putting the dead id on the control split the panel
		// against itself: the summary named the fallback theme while every chip compared against the
		// dead id and reported `aria-pressed="false"`, so no chip looked selected.
		this.selectedThemeId = themeForSelection(selection).id;
		this.voice = { ...selection.voice };
		this.glitter = selection.glitter;
		// The wig is deliberately NOT applied here, and this is the third field to move out of this
		// function for the same reason: it is artifact provenance, not a control.
		//
		// Nothing shows it. `restoredStyleWig` has no control of its own — the carousel reads
		// `selectedWig`, which stays null — so applying it here on the draft path put a wig into the
		// next `Vibe:` line that the reader could neither see nor deselect, and `handleGeneratePage`
		// reads that fallback *before* the reset clears it. A refresh could therefore spend a paid
		// generation on a wig from a draft, chosen invisibly. Restoring a visible catalog selection
		// instead is not available: a stored selection carries the wig's name and style, not its
		// catalog id, and the catalog is not loaded on this path.
		//
		// `loadCreation` sets it, because there the wig belongs to a page that is actually on the
		// paper — see the artifact snapshot there.
	}

	/**
	 * Restore a page's style, or record that the page did not come with one.
	 *
	 * Both restore paths — the vault and the draft — go through here, so the two cannot answer the
	 * "what if there is no stored selection?" question differently. They already drifted once on the
	 * neighbouring question of which verdict belongs to a page; one function is how that stops
	 * being possible.
	 *
	 * When there is no stored selection the controls are left exactly as the reader set them.
	 *
	 * Resetting them to the defaults instead was the first attempt, and a test caught it being
	 * wrong: those controls are the reader's, not the record's, so reopening any page saved before
	 * this field existed would have silently thrown away settings they had just chosen — arbitrary
	 * destruction, to replace a lie with a different lie. The lie is what needed removing, and the
	 * notice removes it. Nothing the reader owns is touched to do that.
	 *
	 * This puts a stored style on the controls and does nothing else. It used to also record the
	 * selection as the *artifact's* — which is right for the vault, where there is an artifact, and
	 * wrong for a draft, where there is not. A draft restores no prompt and no image, so a reader
	 * who came back after a refresh, changed a theme and saved got a record holding the draft's old
	 * style beside a spec rebuilt from the new controls. Both paths still answer "no stored
	 * selection?" through this one function; the artifact snapshot now lives with the artifact,
	 * which only `loadCreation` has.
	 */
	private applyRestoredStyleSelection(selection: StyleSelection | undefined): void {
		if (selection) {
			this.applyStyleSelection(selection);
		}
	}

	/**
	 * The style the live controls are entitled to claim.
	 *
	 * The controls themselves, except when the page on the paper was restored from a record that
	 * stored no style: there they are the reader's own settings sitting next to somebody else's
	 * page, and writing them down would invent provenance the record never had. That is the case
	 * `styleSelectionUnknown` exists to name, and it is the one rule the vault and the draft share.
	 *
	 * Shared through one function because the two writers of this field had drifted once already:
	 * the vault applied this rule, the draft wrote the live controls unconditionally. So reopening
	 * a record with no stored style, waiting for the autosave and refreshing brought the page back
	 * wearing the reader's controls as its own — the unknown-style notice gone, the invented values
	 * now restorable, and a later vault save able to pair them with that record's intent
	 * permanently. The whole point of the field is that it is absent when the answer is not known.
	 */
	private authoredStyleSelection(): StyleSelection | undefined {
		return this.styleSelectionUnknown ? undefined : this.currentStyleSelection();
	}

	/**
	 * The style the *vault* should file a page under: the artifact's.
	 *
	 * Captured when the picture was made, so a control moved afterwards cannot file the page under a
	 * style that never produced it. With no artifact snapshot — a page saved before any generation —
	 * the controls genuinely authored the spec being saved, so they are its style, subject to the
	 * unknown rule above.
	 *
	 * This is the vault's rule and only the vault's, and that separation is the point. Both writers
	 * used to call one accessor, which paired the artifact's style with whatever intent the caller
	 * happened to save — right for the vault, which saves the artifact's spec beside it, and wrong
	 * for the draft, which saves the live one. A review found the pair coming apart: generate under
	 * one theme, move a control to another without regenerating, and the debounced draft wrote an
	 * intent rebuilt for the new theme beside the old theme's selection. A refresh then reapplied
	 * the old theme over the new intent — the reader's latest choice gone, and `decorations`, which
	 * is derived from the style hint, describing a theme the stored selection contradicts.
	 *
	 * So the rule is the pairing, not the accessor: each writer files the style belonging to the
	 * intent it is about to store. See `saveDraft`, which files `authoredStyleSelection` beside the
	 * live spec.
	 */
	private artifactStyleSelection(): StyleSelection | undefined {
		return $state.snapshot(this.generatedStyleSelection) ?? this.authoredStyleSelection();
	}

	private currentDedication(): string | undefined {
		const trimmed = this.dedication.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	private async saveDraft(): Promise<void> {
		if (this.isSavingDraft) {
			this.isDraftSavePending = true;
			return;
		}
		this.isSavingDraft = true;
		this.draftSaveError = '';
		try {
			const result = await creationStoreAdapter.saveDraft({
				draft: {
					updatedAtISO: new Date().toISOString(),
					intent: $state.snapshot(this.spec),
					chatMessage: this.evidence.trim().length > 0 ? this.evidence : undefined,
					// Exactly the rule the vault uses, through the same accessor. A draft that
					// carried text this page does not own would come back after a refresh as
					// genuine, with nothing left to say otherwise.
					studioText: this.describingStudioText(),
					// Saved for the same reason the vault saves it, and it matters more here: a
					// draft is restored on every refresh, so a draft without the style was a page
					// whose look changed every time the reader came back to it.
					//
					// The *live* style, because the line above stores the *live* spec. A draft is
					// the reader's work in progress, not a finished artifact, and the two fields
					// have to describe the same moment or restoring it reapplies one over the
					// other. Filing the artifact's style here — which this did, through the
					// accessor the vault uses — meant a control moved after generating was written
					// into `intent` and then overwritten on the next refresh by the style it had
					// replaced.
					//
					// Still not a second copy of the "no stored style" rule: that lives in
					// `authoredStyleSelection`, which the vault reaches through
					// `artifactStyleSelection`. Writing the live controls unconditionally is how a
					// reopened record with no stored style came back from a refresh wearing
					// provenance nobody had recorded.
					styleSelection: this.authoredStyleSelection()
				}
			});
			if (result.ok) {
				this.draftSaveError = '';
			} else {
				this.draftSaveError = result.error.message;
			}
		} catch (error) {
			this.draftSaveError = error instanceof Error ? error.message : 'Draft save failed';
		} finally {
			this.isSavingDraft = false;
			if (this.isDraftSavePending) {
				this.isDraftSavePending = false;
				void this.saveDraft();
			}
		}
	}

	private async validateSpec(): Promise<boolean> {
		const validation = await specValidationAdapter.validate({ spec: $state.snapshot(this.spec) });
		this.validationIssues = validation.issues;
		return validation.ok;
	}

	private async applyTextToSpec(
		output: MeechieStudioTextOutput,
		source: SettingChangeSource = 'setting'
	): Promise<void> {
		// `decorations` is derived from `styleHint.includes('receipt')`, and the style hint is the
		// theme's hint concatenated with the voice — where `receipts_out` matches. So the theme is
		// not the only control that moves the derivation, and asking only about the theme left a
		// reopened page's density stuck when the reader changed Intensity.
		//
		// Two facts decide it, each measured where it is actually knowable. The style hint *is* the
		// derivation's input, so comparing it against the last rebuild's answers "did the input
		// change?" exactly rather than by proxy — that is what comparing theme IDs was standing in
		// for, badly, three corrections running. And the panel passes `source`, because one case is
		// invisible to any comparison: clicking the theme chip that is already active leaves the
		// hint identical but is still the reader asking for that theme.
		const styleHint = this.currentStyleHint();
		const derivesDense = derivesDenseDecorations(styleHint);
		const derivationChanged = source === 'theme' || derivesDense !== this.lastDerivesDense;
		this.lastDerivesDense = derivesDense;
		this.spec = buildColoringPageSpecFromMeechieText({
			output,
			pageSize: this.pageSize,
			border: this.border,
			styleHint,
			dedication: this.currentDedication(),
			// Keep the layout only while this is still the reopened page. For anything the studio
			// authored, and for every fresh verdict, this is 'list'.
			listMode: this.restoredPageLayout ? this.spec.listMode : 'list',
			// Layout and footer are the same question — "is this still the page that was reopened?"
			// — so they read the same flag. Reading the footer off `this.spec` unconditionally
			// instead looked simpler and was wrong in one direction: once a footerless toolkit page
			// had been reopened, its missing footer outlived it. A mode change or a new verdict
			// cleared the flag but left that spec in place, so the next studio-authored list was
			// built without a footer, and every rebuild after that read the spec it had just built
			// and kept the absence forever.
			includeFooter: this.restoredPageLayout ? this.spec.footerItem !== undefined : true,
			// And the rest of the reopened page's presentation, for the same reason and off the same
			// flag. Preserving only the layout and the footer still handed back a visibly different
			// page — left-aligned, small, stroke 6 — the moment any setting changed.
			//
			// `decorations` is the one field that is derived from the theme rather than chosen, so it
			// is dropped only when the reader actually picks a theme. Every setting change comes
			// through here, so recomputing unconditionally would have turned a restored dense page
			// minimal on a page-size change alone.
			//
			// See `derivationChanged` above for why it takes both an explicit source and a direct
			// comparison of the style hint to decide this.
			presentation: this.restoredPageLayout
				? derivationChanged
					? { ...this.spec, decorations: undefined }
					: this.spec
				: undefined
		});
		// A rebuild describes the verdict, and a try-on page has no verdict on it. Without this the
		// portrait would keep its place on the paper while the spec around it became a numbered list
		// under someone else's title — see `tryOnPageTitle`.
		if (this.tryOnPageOnScreen && this.tryOnPageTitle) {
			this.spec = this.asTryOnPageSpec(this.spec);
		}
		await this.validateSpec();
		this.scheduleDraftSave();
	}

	private resetGeneratedPage(): void {
		// Every path that replaces what is on the paper comes through here, so this is the one
		// place the load token has to advance. Anything still in flight for the previous page
		// compares its captured token against this and discards itself.
		this.pageLoadToken += 1;
		this.generationError = '';
		this.assembledPrompt = '';
		this.revisedPrompt = '';
		this.violations = [];
		this.recommendedFixes = [];
		this.images = [];
		// Clears the packaged files, the described export row and the export failure sentence in one
		// assignment, because all three are derived from it. `pageExports` also loses the provider's
		// own image through `this.images` above, so nothing from the previous page can be left behind
		// in the row.
		this.packageAttempts = [];
		this.pageFileBaseName = '';
		// Whatever replaces the paper is not a try-on portrait until a try-on generation says so.
		this.tryOnPageOnScreen = false;
		this.tryOnPageTitle = '';
		// Both of these describe a *restored* page, and this is the moment there stops being one.
		// `loadCreation` calls this first and applies the restored style after, so a reopen still
		// gets its own values; every other caller is starting a page the controls genuinely describe.
		this.restoredStyleWig = null;
		this.generatedStyleSelection = undefined;
		this.generatedSpec = undefined;
		// Both of these report a change made to the page that is being replaced right here. Left
		// standing they would describe the previous page's trouble over the new one, which is the
		// same stale-report defect in miniature.
		this.settingsError = '';
		this.settingsIssues = [];
		// A fact about the page being replaced, so it goes with it. `loadCreation` calls this first
		// and sets it after, which is the same order the two artifact snapshots above use.
		this.restoredStyleUnknown = false;
	}

	/**
	 * Clears what is on the page, but keeps the portraits already made.
	 *
	 * Delegates to resetGeneratedPage() so a fresh try-on also clears the assembled
	 * prompt/violations from any prior normal generation, not just the images/PDF —
	 * System Trace renders those independently of packagedFiles/images.
	 */
	private resetTryOnPageState(): void {
		this.resetGeneratedPage();
		this.tryOnError = '';
	}

	/**
	 * Drops every portrait as well. Only for a change that invalidates all of them — which means a
	 * new selfie, since every stored portrait is of the previous one.
	 */
	private discardTryOnPortraits(): void {
		this.resetTryOnPageState();
		this.tryOnPortraits = [];
		// Any request still in flight was made with the previous selfie, so its result must not be
		// filed when it lands. Not $state: nothing renders it.
		this.selfieToken += 1;
	}

	private selfieToken = 0;

	private parseTryOnPortraitImage(portraitUrl: string): GeneratedImage | null {
		const match = portraitUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
		if (!match) return null;
		const subtype = match[2];
		const data = match[3];
		const format = subtype === 'jpeg' ? 'jpg' : subtype;
		if (format !== 'png' && format !== 'jpg' && format !== 'webp') return null;
		// Not `match[1]`: the pattern accepts the non-standard `image/jpg` subtype, so
		// copying the incoming token verbatim would put a bogus media type on the image.
		return {
			id: 'try-on-portrait-1',
			format,
			mimeType: GENERATED_IMAGE_MIME_TYPES[format],
			data,
			encoding: 'base64'
		};
	}

	private currentTextPayload() {
		return this.textOutput
			? {
					verdict: this.textOutput.verdict,
					quote: this.textOutput.quote,
					pageTitle: this.textOutput.pageTitle,
					pageItems: this.textOutput.pageItems.map((item) => item.label),
					rating: this.textOutput.rating
				}
			: undefined;
	}

	private async refreshCreations(): Promise<void> {
		if (!this.owner) return;
		const result = await creationStoreAdapter.listCreations({ owner: this.owner });
		if (!result.ok) {
			// Reads used to fail silently, so a browser with unreadable storage showed an empty
			// vault and no reason for it. Say what happened and leave the last good list up.
			this.vaultError = result.error.message;
			// Tracked apart from `vaultError` because only a failed *read* means "your pages are
			// still there, we just could not see them". A failed write — a restore that could not
			// be saved, say — also sets `vaultError` and can also leave the list empty, and
			// telling that reader their pages could not be read would be false.
			this.vaultReadFailed = true;
			return;
		}
		this.vaultError = '';
		this.vaultReadFailed = false;
		this.nowMs = this.clock.now();
		this.creations = sortVaultCreations(result.value);
	}

	// --- Public action handlers ---
	// Arrow functions ensure stable `this` binding when passed as component callbacks.

	scheduleDraftSave = (): void => {
		if (!this.isBrowser) return;
		if (this.draftTimer) clearTimeout(this.draftTimer);
		this.draftTimer = setTimeout(() => void this.saveDraft(), DRAFT_SAVE_DEBOUNCE_MS);
	};

	/**
	 * What a settings rebuild should describe when there is no verdict on screen.
	 *
	 * An empty studio has nothing but the demo seed, and rebuilding from it is what the reader sees
	 * before they generate anything. A *reopened* page is different: it has a title of its own, and
	 * handing the seed to the rebuild renamed it. That is not hypothetical — the page this matters
	 * for is the reopened wig try-on, whose title is the wig's name and whose verdict is `null`
	 * precisely because it prints no items, so changing the page size alone used to retitle it
	 * THE LANDLORD.
	 *
	 * The seed's `pageItems` ride along and are never printed: a restored page with no items is
	 * `title_only`, `restoredPageLayout` keeps it that way, and that layout discards items.
	 */
	private rebuildSourceText(): MeechieStudioTextOutput {
		if (this.textOutput) return this.textOutput;
		if (!this.restoredPageLayout) return DEFAULT_STUDIO_TEXT_OUTPUT;
		return {
			...DEFAULT_STUDIO_TEXT_OUTPUT,
			verdict: this.spec.title,
			pageTitle: this.spec.title,
			quote: specOwnQuote(this.spec)
		};
	}

	/**
	 * Rebuild the spec from whatever text is current. Reports nothing to Page Controls.
	 *
	 * Separate from `syncSpecFromCurrentText` below because that one is the *panel's handler* and
	 * writes the panel's two error regions. It was doing both jobs, and the wig selector and the
	 * try-on page generator both called it — so a try-on whose intermediate spec did not validate
	 * (a provider title over the length limit, say) copied that into `settingsIssues`, then replaced
	 * the invalid fields with a valid title-only spec, re-validated successfully, and left the
	 * finished page reporting under Page Controls that it had failed its check. A control the reader
	 * never touched, blamed for a page that passed.
	 *
	 * The field's own doc comment claimed "written only by the panel's own handler". It was not, and
	 * the split is what makes the claim true rather than aspirational: reporting now lives in the one
	 * caller that owns those regions, so a new caller cannot leak into them by forgetting to.
	 */
	private rebuildSpecFromCurrentText = async (
		source: SettingChangeSource = 'setting'
	): Promise<void> => {
		await this.applyTextToSpec(this.rebuildSourceText(), source);
	};

	/**
	 * The Page Controls panel's handler: rebuild the spec, then report the outcome beside the
	 * control the reader just moved. The only writer of `settingsError` and `settingsIssues`.
	 */
	syncSpecFromCurrentText = async (
		source: SettingChangeSource = 'setting'
	): Promise<void> => {
		this.settingsError = '';
		this.settingsIssues = [];
		try {
			await this.rebuildSpecFromCurrentText(source);
			// `applyTextToSpec` has already run the check and stored what it found, so this reads
			// that answer rather than paying for a second call to the seam that could disagree with
			// the first. Empty on a pass, which is also what the clear above leaves behind.
			this.settingsIssues = this.validationIssues.map((issue) => issue.message);
		} catch (error) {
			// Reported where the reader is looking — beside the control they just moved — instead of
			// as "Draft not saved:" in the evidence panel, which is what a settings failure used to
			// be dressed up as.
			//
			// Swallowed rather than rethrown. The only caller is a DOM event handler, so rethrowing
			// produced an unhandled rejection and told nobody anything; the message above is the
			// whole report either way.
			//
			// The wording says the change was *not checked*, not that it did not happen. By the time
			// anything here can throw, `applyTextToSpec` has already moved the control and assigned
			// the rebuilt spec; the failure is in validating or recording it. Saying "that change did
			// not apply" over a control that visibly did move was a second thing the panel was wrong
			// about, in a run about a panel that misreports itself.
			this.settingsError =
				error instanceof Error ? error.message : UNCHECKED_SETTINGS_MESSAGE;
		}
	};

	handleDedicationInput = (value: string): void => {
		this.dedication = value;
		this.spec = { ...this.spec, dedication: this.currentDedication() };
		void this.validateSpec();
		this.scheduleDraftSave();
	};

	handleModeSelect = (modeId: string): void => {
		const modeChanged = modeId !== this.activeModeId;
		this.activeModeId = modeId;
		this.textError = '';
		if (modeChanged) {
			this.textOutput = null;
			this.resetGeneratedPage();
			this.restoredPageLayout = false;
		}
		this.scheduleDraftSave();
	};

	selectWigForTryOn = async (wig: Wig): Promise<void> => {
		const wigChanged = wig.id !== this.selectedWigId;
		this.selectedWig = wig;
		// The reader has taken the wig back, so a reopened page's stored wig provenance stops
		// speaking for the hint. Set unconditionally: re-picking the wig that is already selected is
		// still the reader choosing it, and `wigChanged` is false in exactly that case.
		this.restoredStyleWig = null;
		if (wigChanged) {
			// The coloring page on screen was made from the previous wig's portrait, so it goes.
			// The portraits themselves stay: `tryOnPortraitUrl` follows the selected wig, so this
			// shows the new wig's portrait if it has one and an empty result panel if it does not,
			// and the previous wig's portrait is still there when the reader goes back to compare.
			this.resetTryOnPageState();
		}
		// The previous attempt's failure is about the previous attempt. On the `wigChanged` path
		// `resetGeneratedPage` already clears it along with the page; on the same-wig path nothing
		// did, so a rebuild that failed once stayed on screen through every later success — and
		// re-picking the selected wig is exactly how a reader retries after seeing it. Cleared
		// before the attempt rather than after it, so the line is empty while the retry runs
		// instead of showing a stale sentence about a rebuild that is no longer happening.
		this.generationError = '';
		// Not the panel's handler: the wig is the try-on studio's control, and the panel's summary
		// deliberately does not name it. A rebuild that fails here belongs on the try-on studio's own
		// error line, not filed under settings the reader did not touch.
		//
		// Still swallowed rather than rethrown — this is a DOM event handler, and rethrowing produced
		// an unhandled rejection that told nobody anything.
		try {
			await this.rebuildSpecFromCurrentText();
		} catch (error) {
			this.generationError =
				error instanceof Error ? error.message : UNCHECKED_SETTINGS_MESSAGE;
		}
	};

	setSelfieForTryOn = (
		base64: string,
		mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
	): void => {
		this.selfieBase64 = base64;
		this.selfieMimeType = mimeType;
		// Every stored portrait is of the previous selfie. Keeping them would relabel the old face
		// under the new upload, which is a worse outcome than losing them.
		this.discardTryOnPortraits();
	};

	runTextAction = async (actionId: StudioTextActionId): Promise<void> => {
		let action: ReturnType<typeof getStudioTextAction>;
		try {
			action = getStudioTextAction(actionId);
		} catch {
			this.textError = 'This action is not available. Try Generate Verdict instead.';
			return;
		}
		if (
			!canRunStudioAction(actionId, {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
		) {
			return;
		}
		this.textError = '';
		this.copyStatus = '';
		this.vaultStatus = '';
		const trimmedEvidence = this.evidence.trim();
		const safeEvidence =
			trimmedEvidence.length > 0 || this.activeMode.toolId === 'random_meechie'
				? trimmedEvidence || 'Random Meechie line request.'
				: '';
		if (!safeEvidence) {
			this.textError = 'Meechie needs a few facts before she can call it.';
			return;
		}

		this.isTextWorking = true;
		try {
			const payload = await postJson(
				'/api/meechie-studio-text',
				{
					actionId: action.aiAction,
					modeId: this.activeMode.id,
					modeLabel: this.activeMode.label,
					themeLabel: this.activeTheme.label,
					evidence: safeEvidence,
					dedication: this.currentDedication(),
					voice: $state.snapshot(this.voice),
					currentText: this.currentTextPayload()
				},
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.studioText }
			);
			const parsed = MeechieStudioTextResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.textError = 'Meechie sent back a line the studio could not read.';
				return;
			}
			if (!parsed.data.ok) {
				this.textError = parsed.data.error.message;
				return;
			}
			this.textOutput = parsed.data.value;
			this.revisionBudget = consumeStudioActionBudget(this.revisionBudget, actionId);
			this.resetGeneratedPage();
			// Only now, with a replacement verdict accepted, does a reopened page's layout stop
			// applying. Clearing it when the action *started* would convert the restored quote page
			// into a numbered list whenever the action then failed, timed out, or was rejected —
			// while its text was still the text on screen.
			this.restoredPageLayout = false;
			await this.applyTextToSpec(parsed.data.value);
		} catch (error) {
			this.textError =
				error instanceof Error ? error.message : 'Meechie could not reach the AI text service.';
		} finally {
			this.isTextWorking = false;
		}
	};

	/**
	 * Package one variant of what is on the paper, turning every way it can go wrong into an
	 * attempt that names its own failure.
	 *
	 * The seam reports a refusal in its `Result` and can still reject outright — pdf-lib throwing on
	 * bytes it cannot embed, a missing canvas — and both mean the same thing to a reader: this
	 * download is not available, and here is why. Catching here is what keeps a packaging failure out
	 * of the caller's `catch`, which writes `generationError` and would report a finished page as a
	 * failed generation.
	 */
	private async packageVariant(
		variant: (typeof STUDIO_EXPORT_VARIANTS)[number],
		images: GeneratedImage[],
		fileBaseName: string,
		pageSize: PageSize
	): Promise<PageExportAttempt> {
		try {
			const result = await outputPackagingAdapter.package({
				images,
				outputFormat: 'pdf',
				fileBaseName,
				pageSize,
				variants: [variant]
			});
			return result.ok
				? { variant, files: result.value.files, error: null, pageSize }
				: { variant, files: [], error: result.error.message, pageSize };
		} catch (error) {
			return {
				variant,
				files: [],
				error: error instanceof Error ? error.message : 'Packaging failed.',
				pageSize
			};
		}
	}

	/**
	 * Build every download for what is on the paper — unless the page was replaced while packaging
	 * ran, in which case the late files belong to a page nobody is looking at.
	 *
	 * The one implementation for all three paths that put a page on the paper: a generation, a
	 * try-on page, and reopening a saved one. Reopening used to have its own near-copy of this, and
	 * the copies had already diverged — that one swallowed every failure, so a reopened page whose
	 * PDF could not be rebuilt showed a disabled Download button and no reason, forever. Deleting the
	 * second copy is what stops them diverging again.
	 *
	 * Both variants are packaged in sequence rather than in one call, so a variant that fails does
	 * not take the other down with it: the seam returns on its first error, so asking for print and
	 * square together loses the print PDF whenever the square rasterisation is the thing that breaks.
	 */
	/**
	 * `pageSize` is passed in rather than read off `this.spec`, because by the time this runs the
	 * live spec may already be somebody else's. The Page Controls stay enabled while a generation is
	 * in flight and moving Page Size rebuilds `this.spec` without advancing `pageLoadToken`, so
	 * reading it here packaged the PDF and the share image for different paper than the picture and
	 * the saved record — the same drift the artifact snapshot removes, one step further down.
	 */
	private async attachPageExports(
		fileBaseName: string,
		pageToken: number,
		pageSize: ColoringPageSpec['pageSize']
	): Promise<void> {
		if (this.images.length === 0) return;
		const images = $state.snapshot(this.images);
		// Set before packaging, not after: the provider's own image is downloadable the moment the
		// page lands, and packaging takes seconds. Naming it only afterwards would hand anyone who
		// grabbed it early a file named after no page in particular. Safe against a late attempt for
		// a replaced page, because the only thing that makes an attempt stale is `resetGeneratedPage`,
		// which clears this field on its way past.
		this.pageFileBaseName = fileBaseName;
		const attempts: PageExportAttempt[] = [];
		for (const variant of STUDIO_EXPORT_VARIANTS) {
			const attempt = await this.packageVariant(variant, images, fileBaseName, pageSize);
			// Checked between variants, not only at the end: the square variant rasterises a fresh
			// canvas, and starting that for a page the reader has already replaced spends time and
			// memory on a result that is guaranteed to be thrown away.
			if (pageToken !== this.pageLoadToken) return;
			attempts.push(attempt);
		}
		this.packageAttempts = attempts;
	}

	handleGeneratePage = async (): Promise<void> => {
		if (!this.textOutput) {
			this.generationError = 'Generate Meechie words before creating the page.';
			return;
		}
		// Read before `resetGeneratedPage`, which clears the restored wig provenance. Regenerating a
		// reopened page keeps its theme, voice and glitter — those live on the controls and the reset
		// does not touch them — so the wig has to keep pace or the paid request goes out describing a
		// page that is partly the record's and partly the carousel's.
		const requestedStyle = this.currentStyleSelection();
		this.resetGeneratedPage();
		// The same capture the try-on path makes, for the same reason: everything below is read
		// after an await, and every path that replaces the paper advances this token. Without it a
		// slow generation lands its prompt, images and PDF on whatever verdict is on screen when it
		// finishes — which is the defect the mode routes already guard against, and this one did not.
		const pageToken = this.pageLoadToken;
		this.isGenerating = true;
		try {
			await this.applyTextToSpec(this.textOutput);
			if (pageToken !== this.pageLoadToken) return;
			if (this.validationIssues.length > 0) {
				this.generationError = 'Fix the page settings before generating.';
				return;
			}
			// `requestedStyle` was read at the top, before the reset. One read, used for both the
			// request and the record: reading it again after the await was a race, because the Page
			// Controls stay enabled while a generation is in flight and moving one does not advance
			// `pageLoadToken`.
			// The spec the request actually carries, read once. Same rule as `requestedStyle`: the
			// Page Controls stay enabled while a generation is in flight, and moving Page Size or
			// Border rebuilds `this.spec` without advancing `pageLoadToken`, so reading it again
			// after the await would record paper the provider was never asked for.
			const requestedSpec = $state.snapshot(this.spec);
			const payload = await postJson(
				'/api/generate',
				{
					spec: requestedSpec,
					styleHint: buildStyleHint(requestedStyle)
				},
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.generate }
			);
			if (pageToken !== this.pageLoadToken) return;
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.generationError = 'Generate response did not match contract.';
				return;
			}
			if (!parsed.data.ok) {
				this.generationError = parsed.data.error.message;
				return;
			}
			this.assembledPrompt = parsed.data.value.prompt;
			this.images = parsed.data.value.images;
			this.revisedPrompt = parsed.data.value.revisedPrompt || '';
			this.violations = parsed.data.value.violations;
			this.recommendedFixes = parsed.data.value.recommendedFixes;

			// A generate response can be schema-valid and still carry no picture: `images` is
			// `z.array(...)` with no minimum. That used to reach the packaging seam and come back as
			// "No images provided for packaging." — a message about a step that should never have
			// been entered, in a field the reader has no way to connect to what happened. The trace
			// above is assigned first so the System Trace still shows what was asked for.
			if (this.images.length === 0) {
				this.generationError =
					'Meechie sent the words back without a picture. Try creating the page again.';
				return;
			}

			// The artifact snapshot, taken only now that there is an artifact — below this guard, not
			// above it with the trace. Assigning it before the guard filed a request that produced
			// nothing as though it had produced a page: `textOutput` still lights up Save to Vault,
			// so saving after the failure stored that request's style and spec, and went on doing so
			// after the reader had moved every control. Values captured before the await, not read
			// off the live controls, for the reason given where each was captured.
			this.generatedStyleSelection = requestedStyle;
			this.generatedSpec = requestedSpec;

			const creationId = this.generateCreationId();
			await this.attachPageExports(
				`meechie-coloring-page-${creationId}`,
				pageToken,
				requestedSpec.pageSize
			);
		} catch (error) {
			this.generationError =
				error instanceof Error ? error.message : 'Coloring page generation failed.';
		} finally {
			this.isGenerating = false;
		}
	};

	handleGenerateTryOnPage = async (): Promise<void> => {
		// See `canGenerateTryOnPage`. Guarded here too, not only on the button: the race is between
		// two state transitions, so the state is where it has to be refused.
		if (this.isTryingOn) {
			this.generationError = 'Wait for the new look to finish before making the page.';
			return;
		}
		const wig = this.selectedWig;
		// Captured together, before any await, because they have to describe the same look.
		// `tryOnPortraitUrl` is derived from the selected wig, and the carousel stays live during
		// generation, so re-reading it after the await could return a different wig's portrait —
		// and the title and prompt below are built from `wig`. That combination packages one wig's
		// picture under another wig's name.
		const portraitUrl = this.tryOnPortraitUrl;
		if (!portraitUrl || !wig) {
			this.generationError = 'Create a try-on portrait first.';
			return;
		}
		this.resetGeneratedPage();
		// Taken after the reset, which advances it. Selecting another wig resets the page again, so
		// a moved token means the reader is no longer looking at the page they asked for.
		const pageToken = this.pageLoadToken;
		this.isGenerating = true;
		try {
			// Captured before the await, like `wig` above and like the generate path: the spec this
			// page gets is built from these controls, so reading them again afterwards could record
			// a style the page was not built with.
			const requestedStyle = this.currentStyleSelection();
			// The bare rebuild, not the panel's handler. The spec it builds here is an intermediate —
			// `asTryOnPageSpec` replaces the title-bearing half of it four lines down and the result
			// is re-validated — so reporting this one's findings under Page Controls announced a
			// failure about a spec that no longer exists, on a page that went on to pass. The enclosing
			// catch turns a genuine failure here into `generationError`, which is where a try-on that
			// could not be made belongs.
			await this.rebuildSpecFromCurrentText();
			if (pageToken !== this.pageLoadToken) return;
			const portraitImage = this.parseTryOnPortraitImage(portraitUrl);
			if (!portraitImage) {
				this.generationError =
					'Try-on portrait format is not supported for coloring-page export.';
				return;
			}
			// A try-on page is a portrait, not a list, so it takes the whole title-only shape and not
			// just a new title. `syncSpecFromCurrentText` builds the spec from
			// `DEFAULT_STUDIO_TEXT_OUTPUT` when no verdict has been generated, so replacing the
			// title alone left the demo seed's items — THE RENT, THE DOPEMAN, WHAT IT COST — and its
			// footer on the record. `loadCreation` rebuilds a no-`studioText` record's words from
			// `intent.items`, so reopening a saved try-on put those unrelated lines in the preview
			// and in the evidence box, which is the text the reader's next verdict request sends.
			//
			// `title_only` with no items and no footer is the shape the schema requires
			// (`ColoringPageSpecSchema` rejects items or a footer in title-only mode) and the one
			// the page actually is.
			this.tryOnPageTitle = compactColoringPageTitle(['Wig Try-On', wig.name]);
			this.spec = this.asTryOnPageSpec(this.spec);
			// `assembledPrompt` is required and non-empty on a vault record, and this path never
			// calls the image provider so there is no real prompt to record. It gets a description
			// of the page instead of a machine prompt on purpose: `loadCreation` puts a reopened
			// record's own words in the evidence box, and a prompt there is shipped to the provider
			// as the reader's facts on their next Generate Verdict — the defect recorded at that
			// call site.
			this.assembledPrompt = `Wig try-on portrait — ${wig.name} (${wig.style}).`;
			// The spec the page was actually built as, read here rather than after the await below,
			// where a control change could have rebuilt it. Same rule as the generate path.
			const requestedSpec = $state.snapshot(this.spec);
			// Re-validated because the title above was written after `syncSpecFromCurrentText` had
			// already validated. Checking the issues it left would be checking the previous spec.
			await this.validateSpec();
			if (this.validationIssues.length > 0) {
				this.generationError = 'Fix the page settings before generating.';
				return;
			}
			this.images = [portraitImage];
			// The artifact snapshot, below the guard rather than above it, for the reason the
			// generate path gives: assigned before it, a run that reported a settings problem and
			// made no page still filed one.
			this.generatedStyleSelection = requestedStyle;
			this.generatedSpec = requestedSpec;
			// From here the paper is a portrait, so no verdict describes it. See `tryOnPageOnScreen`.
			this.tryOnPageOnScreen = true;
			const creationId = this.generateCreationId();
			await this.attachPageExports(
				`meechie-try-on-coloring-page-${creationId}`,
				pageToken,
				requestedSpec.pageSize
			);
		} catch (error) {
			this.generationError =
				error instanceof Error ? error.message : 'Try-on coloring page generation failed.';
		} finally {
			this.isGenerating = false;
		}
	};

	/**
	 * Files a finished portrait under the wig it was actually requested for, replacing that wig's
	 * previous portrait in place so the compare strip keeps its order.
	 */
	private storeTryOnPortrait(portrait: TryOnPortrait): void {
		const existing = this.tryOnPortraits.findIndex(
			(entry) => entry.wig.id === portrait.wig.id
		);
		if (existing >= 0) {
			this.tryOnPortraits = this.tryOnPortraits.map((entry, index) =>
				index === existing ? portrait : entry
			);
			return;
		}
		this.tryOnPortraits = [...this.tryOnPortraits, portrait];
	}

	handleWigTryOn = async (): Promise<void> => {
		const wig = this.selectedWig;
		if (!wig || !this.selectedWigId || !this.selfieBase64) {
			this.tryOnError = 'Select a wig and upload your selfie first.';
			return;
		}
		// Both captured before the await: styling takes long enough that the reader can pick another
		// wig, or upload a different photo, while it runs.
		//
		// The wig decides where the result is filed, so a late portrait can no longer appear under —
		// and be labelled as — whichever wig is selected when it lands. The selfie decides whether it
		// is filed at all: a new upload clears the portraits precisely because they are of the old
		// face, and a request already in flight would otherwise put one straight back, to sit in the
		// compare strip beside portraits of the new face as though they were the same person.
		const requestedWig = wig;
		const requestedSelfieToken = this.selfieToken;
		this.resetTryOnPageState();
		this.isTryingOn = true;
		try {
			const payload = await postJson(
				'/api/wig-try-on',
				{
					selfieBase64: this.selfieBase64,
					selfieMimeType: this.selfieMimeType,
					wigId: requestedWig.id
				},
				{ timeoutMs: POST_JSON_TIMEOUTS_MS.wigTryOn }
			);
			const parsed = WigTryOnResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.setTryOnError(
					'Try-on response did not match contract.',
					requestedWig.id,
					requestedSelfieToken
				);
				return;
			}
			if (!parsed.data.ok) {
				this.setTryOnError(parsed.data.error.message, requestedWig.id, requestedSelfieToken);
				return;
			}
			// The portrait is of the selfie that was current when it was requested. If that is no
			// longer the selfie on screen, it belongs to nobody now and is dropped rather than filed.
			if (requestedSelfieToken !== this.selfieToken) return;
			this.storeTryOnPortrait({
				wig: requestedWig,
				portraitUrl: `data:${parsed.data.value.portraitMimeType};base64,${parsed.data.value.portraitBase64}`
			});
		} catch (error) {
			this.setTryOnError(
				error instanceof Error ? error.message : 'Wig try-on failed.',
				requestedWig.id,
				requestedSelfieToken
			);
		} finally {
			this.isTryingOn = false;
		}
	};

	/**
	 * Shows a try-on failure only while it is still the reader's failure to read: the wig it
	 * happened to is still on screen, and the selfie it was for is still the uploaded one. A
	 * failure for a wig they have moved off, or for a photo they have replaced, is neither.
	 */
	private setTryOnError(message: string, wigId: string, selfieToken: number): void {
		if (this.selectedWigId !== wigId) return;
		if (selfieToken !== this.selfieToken) return;
		this.tryOnError = message;
	}

	copyQuote = async (): Promise<void> => {
		if (!this.textOutput || !this.isBrowser) return;
		try {
			await navigator.clipboard.writeText(this.textOutput.quote);
			this.copyStatus = 'Quote copied.';
		} catch {
			this.copyStatus = 'Copy unavailable in this browser.';
		}
	};

	saveToVault = async (): Promise<void> => {
		if (this.isSaving) return;
		const owner = this.owner;
		const textOutput = this.textOutput;
		if (!owner) {
			this.vaultStatus = 'Session is still connecting. Try again in a moment.';
			return;
		}
		// A page made from a wig try-on has no verdict behind it, and used to be the one page in
		// the app that could not be kept: the button was disabled on `textOutput` alone, so the
		// portrait died with the tab while every other surface reached the vault. `studioText` is
		// optional on the record and `loadCreation` already restores records without it, so the
		// real requirement is a page — words or a picture, either one.
		const assembledPrompt = this.assembledPrompt || textOutput?.quote || '';
		if (!textOutput && this.images.length === 0) {
			this.vaultStatus = 'Make a page before saving it.';
			return;
		}
		if (!assembledPrompt) {
			this.vaultStatus = 'This page has nothing to save yet.';
			return;
		}
		this.isSaving = true;
		this.vaultStatus = 'Saving...';
		// The page as it was made, not as the controls now describe it. `this.spec` is rebuilt from
		// the live Page Controls on every setting change, so any setting moved after the picture came
		// back put a spec on the record that never produced its own image, prompt or downloads —
		// dimensions and a frame, and `decorations`, which is derived from the style hint and so
		// contradicted the `styleSelection` saved beside it.
		//
		// Falls back to the live spec when there is no snapshot, which is the page saved before any
		// generation: there its controls genuinely did author the spec being saved.
		//
		// `dedication` is deliberately the reader's, not the artifact's. It is the one field here
		// they type directly rather than choose from a control, and a dedication entered after
		// generating is on no page at all — so keeping the snapshot's would silently discard what
		// they just wrote, which is a different defect from the one this snapshot removes and not
		// one to introduce while removing it. That a typed dedication can still describe a picture
		// without it predates this change; it belongs with the drift reporting, not here.
		const liveSpec = $state.snapshot(this.spec);
		// Snapshotted out of `$state` on the way to the seam, which stores JSON: a proxy is what the
		// record would otherwise be built from, and the two snapshot fields are reactive now.
		const artifactSpec = $state.snapshot(this.generatedSpec);
		const intent = artifactSpec ? withDedication(artifactSpec, liveSpec.dedication) : liveSpec;
		const creationId = this.generateCreationId();
		const storedImages = this.images.map((image) => ({
			b64: image.encoding === 'base64' ? image.data : this.encodeBase64(image.data)
		}));
		try {
			const result = await creationStoreAdapter.saveCreation({
				record: {
					id: creationId,
					createdAtISO: new Date().toISOString(),
					intent,
					assembledPrompt,
					// Only text that actually describes this page is saved as its own.
					studioText: this.describingStudioText(),
					revisedPrompt: this.revisedPrompt || undefined,
					images: storedImages.length > 0 ? storedImages : undefined,
					violations: $state.snapshot(this.violations),
					fixesApplied: this.recommendedFixes.map((fix) => fix.code),
					authContext: this.authContext ?? undefined,
					// The style that produced this page — captured when the picture was made, not read
					// off the controls now. `intent` carries page size and border; the theme, voice
					// and glitter that composed the `Vibe:` line reach the page only through the
					// style hint, so without this the record describes a page's layout and none of
					// its look. Reading it live would store whatever the panel happens to say at save
					// time, which after a post-generation control change is a style that never made
					// this image.
					// A page saved without ever generating an image has no artifact snapshot — only the
					// generate paths take one — but its controls did author the spec being saved, so
					// they are its style. `styleSelectionUnknown` is precisely the case where they are
					// *not*: a record restored without a stored style, whose prompt and picture came
					// from choices nobody wrote down.
					styleSelection: this.artifactStyleSelection(),
					owner
				}
			});
			this.vaultStatus = result.ok ? 'Saved to the quote vault.' : result.error.message;
			await this.refreshCreations();
		} catch (error) {
			this.vaultStatus = error instanceof Error ? error.message : 'Failed to save to vault.';
		} finally {
			this.isSaving = false;
		}
	};

	loadCreation = async (creation: CreationRecord): Promise<void> => {
		// `null` for a page that prints no items — a reopened try-on portrait, say. Nothing on that
		// page is a verdict, so nothing is restored as one; see `buildStudioTextFromSpec`.
		const restoredText = buildStudioTextFromCreationRecord(creation);
		// Decoded up here rather than at the assignment below, because whether this record puts a
		// picture on the paper is what decides the artifact snapshots — and a record whose stored
		// bytes do not decode restores none. Asking `creation.images` would be asking what the
		// record claims; this asks what the reader is actually looking at.
		const restoredImages = restoreCreationImages(creation);
		this.resetGeneratedPage();
		this.spec = creation.intent;
		// This page's layout is the saved page's, not the studio's, until a new verdict replaces it.
		this.restoredPageLayout = true;
		// And this page's *look* is the saved page's too, for exactly the same reason. Restoring the
		// layout while leaving the style controls where they were is what made a reopened page
		// change its vibe on the next page-size change: `applyTextToSpec` recomposes the hint from
		// whatever the controls say, and they were saying Crown Energy over somebody else's page.
		//
		// Applied before the derivation is seeded below, not after: the seed is read off the
		// controls, so seeding first would describe a page that was never on screen — and that seed
		// is what the next setting change is decided against.
		this.applyRestoredStyleSelection(creation.styleSelection);
		// Whether this record stored a style is a fact about the record, true whether or not it also
		// carries a picture. Held apart from the snapshots below, which are about the picture.
		this.restoredStyleUnknown = creation.styleSelection === undefined;
		// The two artifact snapshots — but only when this record actually put a picture on the paper.
		//
		// They exist so that reopening a page, changing a setting and saving again cannot write the
		// rebuilt spec over the picture the record was saved with. A record saved before any image
		// was generated has no such picture, so there is nothing for the reader's later changes to
		// contradict, and taking a snapshot there made `saveToVault` prefer the old intent and throw
		// their changes away on the next save.
		//
		// This is the same "snapshot taken where there is no artifact" the generate paths were
		// corrected for two rounds earlier — the restore door, missed then. The comment here used to
		// read "the one restore path that has an artifact", which was the claim rather than the code.
		if (restoredImages.length > 0) {
			this.generatedSpec = creation.intent;
			this.generatedStyleSelection = creation.styleSelection;
		}
		// The wig belongs with them, and so does the guard: it is this page's, not the carousel's,
		// and regenerating a reopened page must keep it rather than reach for whatever the reader has
		// selected now. Left `null` for a record with no stored style, which is the case the panel
		// reports as unknown rather than guesses at.
		//
		// Inside the image guard for a reason the first version of that guard missed. This is stored
		// as `{ name, style }`, not a catalog `Wig`, so it cannot be put back into the carousel —
		// which means on a record with no picture it was an *invisible* wig: nothing selected on
		// screen, and Create Coloring Page quietly sending it in a paid request. With no artifact
		// there is nothing for the reader's selection to contradict, so the visible one wins.
		if (restoredImages.length > 0 && creation.styleSelection) {
			this.restoredStyleWig = { value: creation.styleSelection.wig };
		}
		// Seed the derivation input at restore time, so the first setting change that does not touch
		// it compares equal and keeps the density the saved page was built with.
		this.lastDerivesDense = derivesDenseDecorations(this.currentStyleHint());
		// The evidence box is an editable field the reader's next Generate Verdict sends to the text
		// provider as their own words, so what lands in it matters more than a display string does.
		// This fell back to `assembledPrompt` — the image-generation prompt — for any record saved
		// without studio text, which put `STYLE: bold outline art / NEGATIVE PROMPT: ...` in the box
		// and shipped those machine instructions to the provider as user facts on the next click.
		// `restoredText` already resolves the same `studioText.quote` when it exists and the page's
		// own words when it does not, so read it from there and never from the prompt. A page with
		// no printed items restores no text at all, and `specOwnQuote` is the rule that text would
		// have used — one implementation, so the box cannot say something the page does not.
		this.evidence = restoredText?.quote ?? specOwnQuote(creation.intent);
		this.dedication = creation.intent.dedication ?? '';
		this.pageSize = creation.intent.pageSize;
		this.border = creation.intent.border;
		this.textOutput = restoredText;
		// Reopening a saved page used to hand back the words and drop the picture, so the only
		// way to see your own page again was to pay for another generation. The record already
		// carries the image bytes and the trace, so give all of it back.
		this.images = restoredImages;
		this.assembledPrompt = creation.assembledPrompt;
		this.revisedPrompt = creation.revisedPrompt ?? '';
		this.violations = creation.violations ?? [];
		this.vaultStatus = `Reopened "${creation.intent.title}".`;
		await this.validateSpec();
		// The same builder the two generation paths use, so a reopened page gets the same downloads a
		// freshly generated one does — and reports what it could not build instead of leaving a dead
		// button with no reason, which is what its own near-copy of this used to do.
		await this.attachPageExports(
			`meechie-coloring-page-${this.generateCreationId()}`,
			this.pageLoadToken,
			creation.intent.pageSize
		);
		this.scheduleDraftSave();
	};

	setVaultQuery = (value: string): void => {
		this.vaultQuery = value;
		// A search that hides the armed row would otherwise leave a delete primed off-screen.
		this.pendingDeleteId = null;
	};

	toggleVaultShowAll = (): void => {
		this.vaultShowAll = !this.vaultShowAll;
		// Collapsing can hide the armed row exactly as a search can, and an armed delete left
		// off-screen would still be primed when the list is expanded again.
		this.pendingDeleteId = null;
	};

	requestDeleteCreation = (id: string): void => {
		this.pendingDeleteId = id;
		this.vaultError = '';
	};

	cancelDeleteCreation = (): void => {
		this.pendingDeleteId = null;
	};

	deleteCreation = async (id: string): Promise<void> => {
		const removed = this.creations.find((creation) => creation.id === id) ?? null;
		const result = await creationStoreAdapter.deleteCreation({ id });
		this.pendingDeleteId = null;
		if (!result.ok) {
			this.vaultError = result.error.message;
			return;
		}
		this.vaultError = '';
		// Keep a full copy so Undo can put the exact record back, not a reconstruction of it.
		this.undoableDeletion = removed ? $state.snapshot(removed) : null;
		this.vaultStatus = removed
			? `Deleted "${removed.intent.title}".`
			: 'Deleted.';
		await this.refreshCreations();
	};

	undoDelete = async (): Promise<void> => {
		const record = this.undoableDeletion;
		if (!record) return;
		// The store keeps a fixed number of records and drops the oldest past that. If the slot
		// freed by the delete has since been taken by a new save, restoring would push the list
		// back over the cap and silently evict another page — the exact failure this whole feature
		// exists to stop — while reporting only that this one came back. Refuse, and say why,
		// rather than trading one lost page for another.
		//
		// This is a lower bound, not a store-wide guarantee. `creations` holds only the records
		// matching the current owner, while the adapter applies its cap to the whole stored array.
		// The two agree while `cb_session_id_v1` survives, since `buildOwner` derives the single
		// owner from it; records orphaned under a previous session id still occupy slots this
		// count cannot see. Closing that gap means deciding capacity inside `CreationStoreSeam` or
		// exposing it through the contract — a contract change, and so the full Seam-Driven
		// Development workflow. It is tracked with the other deferred seam work in
		// `WORST_TO_BEST_LOG.md` rather than widened into this fix.
		if (this.creations.length >= VAULT_CAPACITY) {
			// Deliberately does not say "delete a page, then undo". `deleteCreation` replaces
			// `undoableDeletion` with whatever was deleted last, so following that instruction
			// would discard this record and leave Undo holding the page just deleted to make room
			// for it. Say what is true, and what it costs, instead of scripting a move that
			// destroys the thing the reader is trying to save.
			this.vaultError =
				`The vault is full at ${VAULT_CAPACITY} pages, so "${record.intent.title}" cannot ` +
				'come back without pushing another page out. It is still held here for now — but ' +
				'Undo only ever holds the most recent deletion, so deleting another page to make ' +
				'room would replace it. Download the page you want to keep before freeing a slot.';
			return;
		}
		const result = await creationStoreAdapter.saveCreation({ record });
		if (!result.ok) {
			this.vaultError = result.error.message;
			return;
		}
		this.vaultError = '';
		this.undoableDeletion = null;
		this.vaultStatus = `Restored "${record.intent.title}".`;
		await this.refreshCreations();
	};

	dismissUndoDelete = (): void => {
		this.undoableDeletion = null;
	};

	toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		const result = await creationStoreAdapter.saveCreation({
			record: { ...$state.snapshot(creation), favorite: !creation.favorite }
		});
		if (!result.ok) {
			this.vaultError = result.error.message;
			return;
		}
		this.vaultError = '';
		await this.refreshCreations();
	};

	// --- Lifecycle ---

	async init(): Promise<void> {
		this.isBrowser = true;
		// Re-read rather than trusting the field initializer: a test or an alternate host may have
		// replaced `origin` after construction, and the value captured then would be the default
		// adapter's. The clock and visibility seams are consulted here for the same reason.
		this.appOrigin = this.origin.getOrigin();
		this.startSavedLabelRefresh();
		const [sessionResult, draft] = await Promise.all([
			sessionAdapter.getSession(),
			creationStoreAdapter.getDraft({})
		]);
		if (sessionResult.ok) {
			this.owner = this.buildOwner(sessionResult.value.sessionId);
			const authResult = await authContextAdapter.getAuthContext({
				sessionId: sessionResult.value.sessionId
			});
			if (authResult.ok) {
				this.authContext = authResult.value;
			}
		}
		if (draft.ok && draft.value) {
			this.spec = draft.value.intent;
			// A persisted spec carries its own provenance, exactly as `loadCreation` treats one it
			// reads from the vault — so this is unconditionally true, for the same reason that one
			// is. Deriving it from `listMode === 'title_only'` recognised only reopened *quote*
			// pages and missed reopened structured toolkit pages, which are footerless `list`s.
			// Setting it for a studio-authored draft costs nothing: such a spec is a `list` with a
			// footer, so both derivations above return what the false branch would have.
			this.restoredPageLayout = true;
			// Before the seeding below, for the reason given in `loadCreation`.
			this.applyRestoredStyleSelection(draft.value.styleSelection);
			this.lastDerivesDense = derivesDenseDecorations(this.currentStyleHint());
			this.evidence = draft.value.chatMessage || '';
			this.dedication = draft.value.intent.dedication ?? '';
			this.pageSize = draft.value.intent.pageSize;
			this.border = draft.value.intent.border;
			// Two separate reasons a restored draft carries no verdict, and each is answered where
			// it is actually knowable.
			//
			// `isKnownDraftSeed` is the one asked here: the page does print items, but they are the
			// ones the studio ships with, so there is no reader's work to restore.
			//
			// The other is the builder's, and this check could not have made it. A title-only try-on
			// page prints nothing a verdict could describe, and its title — the wig's name — matches
			// no seed signature, so this waved it through and the studio came back from a refresh
			// showing THE RENT / THE DOPEMAN under the wig's name with Save to Vault lit up over a
			// record holding nothing. `buildStudioTextFromDraftRecord` returns null for that page,
			// which is why the assignment is safe to make unconditionally once past this check.
			if (draft.value.studioText || !isKnownDraftSeed(draft.value.intent)) {
				this.textOutput = buildStudioTextFromDraftRecord(draft.value);
			}
		}
		await this.validateSpec();
		await this.refreshCreations();
	}

	// "Saved today" is computed against `nowMs`, which otherwise only advances when the vault is
	// read or written, so a studio left open across UTC midnight keeps showing yesterday's labels.
	// Two things move the clock forward, because the two cases are genuinely different:
	//
	//   - A timer armed at the next UTC day boundary, which re-arms itself for the boundary after
	//     that. This is the case that matters most: a reader who leaves the tab in the foreground
	//     is looking straight at the labels while they go stale, and no event would ever fire.
	//   - `visibilitychange`, for the tab that was suspended in the background. A backgrounded
	//     timer can be throttled or deferred, so the boundary timer alone cannot be relied on to
	//     have fired on time; reading the clock on the way back in fixes the label immediately.
	private startSavedLabelRefresh(): void {
		this.scheduleNextDayBoundaryRefresh();
		this.stopVisibilityWatch = this.visibility.onVisible(() => {
			this.nowMs = this.clock.now();
			// The boundary the old timer was waiting for may already be behind us.
			this.scheduleNextDayBoundaryRefresh();
		});
	}

	private scheduleNextDayBoundaryRefresh(): void {
		this.cancelDayBoundaryRefresh?.();
		this.cancelDayBoundaryRefresh = this.clock.scheduleAt(
			nextUtcDayBoundary(this.clock.now()),
			() => {
				this.nowMs = this.clock.now();
				this.scheduleNextDayBoundaryRefresh();
			}
		);
	}

	destroy(): void {
		if (this.draftTimer) {
			globalThis.clearTimeout(this.draftTimer);
		}
		this.cancelDayBoundaryRefresh?.();
		this.cancelDayBoundaryRefresh = null;
		this.stopVisibilityWatch?.();
		this.stopVisibilityWatch = null;
	}
}
