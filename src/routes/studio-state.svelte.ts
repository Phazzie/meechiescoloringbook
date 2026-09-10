// Purpose: Svelte 5 runes state class encapsulating all Meechie Studio page logic.
// Why: Extracts the 690-line script from +page.svelte into a testable, self-contained
//      state module; the page component becomes a thin lifecycle wrapper.
// Info flow: User actions -> StudioState methods -> reactive $state updates -> component props.
// Invariants: Four distinctions here are load-bearing and must never be collapsed into one
//             another, because each collapse produced a report that said something untrue.
//             (1) `images.length > 0` (a page exists) is INDEPENDENT of `driftReported` (a check
//             spoke about it): inferring either from the other reported a picture-less generation
//             as "came back exactly as asked", and a reopened record as "nothing on the paper yet"
//             while its page was on screen.
//             (2) `checkResultUnrecorded` (nothing was stored) is NOT `driftCheckFailure` (the
//             check named a defect): a saved record cannot tell a completed-but-unsaved result
//             from a failed one, so it must claim neither.
//             (3) `promptWasSent` is NOT "`assembledPrompt` is non-empty": the try-on flow stores a
//             human description there purely to satisfy the vault record's non-empty requirement
//             and never calls a provider.
//             (4) Diagnostics from a generation that installed NO page belong to the REQUEST, and
//             every reset in this class hangs off replacing the *page* — so without
//             `clearPagelessRequestDiagnostics` on the input paths, a findings-but-no-image response
//             left its report and trace under controls that no longer described it. The `images`
//             guard in that method is the whole of its safety: a page on screen keeps its own report
//             through every control change, because the studio deliberately holds a finished page
//             while the reader sets up the next one.
//             `tryOnPageOnScreen` is `$state` rather than a plain field because `qualityReport`
//             derives from it; a plain field would be read once and never follow the paper.
import { VaultCollection } from '$lib/components/vault-collection.svelte';
import { authContextAdapter } from '$lib/adapters/auth-context-seam';
import { creationStoreAdapter } from '$lib/adapters/creation-store-seam';
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
	studioActionStartsRound,
	getStudioTextAction,
	getModeSpotlight,
	describeSpotlightSchedule,
	studioModes,
	studioThemes,
	type ModeSpotlight,
	type StudioTextActionId
} from '$lib/core/meechie-studio';
import { POST_JSON_TIMEOUTS_MS, postJson } from '$lib/core/http-client';
import { AiQuotaMeter } from '$lib/components/ai-quota-meter.svelte';
import { WIG_TRY_ON_QUOTA_COST } from '$lib/core/ai-quota';
import {
	classifyGenerationFailure,
	PAGE_SUBJECT,
	TRY_ON_SUBJECT,
	VERDICT_SUBJECT,
	type GenerationFailure
} from '$lib/core/generation-failure';
import { readIsOnline } from '$lib/components/connection.svelte';
import { compactColoringPageTitle } from '$lib/core/coloring-page-title';
import { buildQualityReport } from '$lib/core/quality-report';
import {
	buildVerdictReport,
	warrantForRestoredVerdict,
	type VerdictWarrant
} from '$lib/core/verdict-report';
import {
	GENERATED_IMAGE_MIME_TYPES,
	generatedImageDataUrl
} from '$lib/core/generated-image-preview';
import {
	describeOriginalImageExport,
	describePackagedExports,
	pageExportFailureDetail,
	rebuildableExportVariants,
	mergeRebuiltAttempts,
	type PageExport,
	type PageExportAttempt
} from '$lib/core/page-exports';
import { packagePageVariant } from '$lib/components/page-packaging';
import {
	VAULT_PREVIEW_COUNT,
	restoreCreationImages
} from '$lib/core/vault-gallery';
import { VAULT_SAVED_CONFIRMATION, describeVaultCount } from '$lib/core/vault-page';
import {
	classifyStorageFailure,
	type StorageFailure,
	type StorageOperation
} from '$lib/core/storage-failure';
import { GenerateResultSchema } from '../../contracts/generate.contract';
import type { GenerateResponseValue } from '../../contracts/generate.contract';
import { WigTryOnResultSchema } from '../../contracts/wig-try-on.contract';
import {
	MeechieStudioTextResultSchema,
	type MeechieStudioTextOutput,
	type MeechieStudioVoiceSettings
} from '$lib/seams/meechie-studio-text-seam/contract';
import type { CreationOwner, CreationRecord } from '$lib/seams/creation-store-seam/contract';
import type { DriftDetectionOutput, Violation } from '../../contracts/drift-detection.contract';
import type { GeneratedImage } from '../../contracts/image-generation.contract';
import type {
	OutputVariant,
	PackagedFile
} from '$lib/seams/output-packaging-seam/contract';
import type {
	ColoringPageSpec,
	SpecValidationOutput
} from '../../contracts/spec-validation.contract';
import type { AppOriginSeam } from '$lib/seams/app-origin-seam/contract';
import type { ClockSeam } from '$lib/seams/clock-seam/contract';
import { newCreationId } from '$lib/components/creation-id';
import type { PageVisibilitySeam } from '$lib/seams/page-visibility-seam/contract';
import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

import {
	buildStyleHint,
	DEFAULT_PAGE_LOOK,
	DEFAULT_STYLE_SELECTION,
	themeForSelection,
	type PageLookSelection,
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
export type SettingChangeSource = 'theme' | 'style' | 'setting';

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
 * The property `recordFailure` writes onto each failure it classifies, recording the order it
 * happened in relative to this studio's other failures.
 *
 * Deliberately not part of `GenerationFailure`: the ordering question is this studio's alone —
 * it is the only surface in the app with three independent failures that can be live at once —
 * and every other surface would carry a field it never writes. A string key rather than a symbol
 * because this value is read back through a `$state` proxy, and a plain property read is the one
 * thing a proxy is guaranteed not to change.
 */
const FAILURE_STAMP = 'studioFailureStamp';

type StampedFailure = GenerationFailure & {
	readonly [FAILURE_STAMP]: number;
};

/**
 * The half of a classifier input that a call site supplies: what actually went wrong.
 *
 * The other half — the subject, the bucket's reset instant, the connection, whether a page survived
 * — is context this studio holds, and each of the three `classify…Failure` helpers below fills it in
 * for its own kind of call. Naming the caller's half once is what stops a call site being able to
 * pass a subject or a quota instant of its own and quietly answer for the wrong bucket.
 */
type FailureCallSiteInput = Pick<
	Parameters<typeof classifyGenerationFailure>[0],
	'thrown' | 'apiError' | 'offContract' | 'rejected'
>;

/** A failure's stamp, or `0` for one that never went through `recordFailure`. */
const stampOf = (failure: GenerationFailure | null): number => {
	if (failure === null) return 0;
	const stamp = (failure as Partial<StampedFailure>)[FAILURE_STAMP];
	return typeof stamp === 'number' ? stamp : 0;
};

/**
 * The most recently classified of the failures still being held, or `null` when none is.
 *
 * `>` rather than `>=`, so an unstamped failure — one a test assigned directly, which is the only
 * way to get one — loses to the earlier entries rather than displacing them.
 */
const newestFailure = (
	failures: readonly (GenerationFailure | null)[]
): GenerationFailure | null =>
	failures.reduce<GenerationFailure | null>(
		(best, failure) =>
			failure !== null && (best === null || stampOf(failure) > stampOf(best))
				? failure
				: best,
		null
	);

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
	/**
	 * Every mode, in catalogue order, on every render.
	 *
	 * This used to be `getWeeklyModes()` — three of the eight, chosen by reading the clock in a
	 * field initializer. Two things were wrong with that beyond the five modes it hid. The comment
	 * on it said "computed per-instance so week/month rotation stays fresh on each page mount",
	 * which is true of the *browser's* instance and false of the one that matters: `/` is
	 * prerendered, so the instance whose HTML ships — and which the service worker caches for the
	 * installed app — is constructed at **build time**, and its three cards were dated to the
	 * build. And nothing refreshed it afterwards: a `readonly` field on a page that an installed
	 * app keeps open for days could not change, in a studio that already schedules a UTC
	 * day-boundary refresh for something as small as a "Saved today" label.
	 *
	 * A constant list has neither problem, because it is the same list on every day and in every
	 * timezone. What the clock decides now is only which cards are *badged*, and that is derived
	 * from `nowMs` below, which the existing day-boundary timer already moves.
	 */
	readonly modes = studioModes;

	// --- Reactive state (template-bound) ---
	/**
	 * False until `init()` has run, which happens only in a browser.
	 *
	 * Declared here rather than beside the other lifecycle fields further down because
	 * `spotlightNote` reads it: class field initializers run in declaration order, and a `$derived`
	 * declared above it would be reading a field TypeScript can prove is not initialized yet.
	 */
	isBrowser = $state(false);
	/**
	 * The mode the studio is set to. Defaults to the first in the catalogue, deliberately not to
	 * the spotlit one: the default decides the heading, the help line, the placeholder, the button
	 * and — through `activeMode.toolId` — which tool the verdict is asked of, and a clock-dependent
	 * default meant the prerendered document and the hydrated page could disagree about all five.
	 */
	activeModeId = $state(studioModes[0].id);
	// The studio's starting style and `DEFAULT_STYLE_SELECTION` were the same three values written
	// out twice. Spread rather than shared, so one instance's voice is not another's.
	selectedThemeId = $state(DEFAULT_STYLE_SELECTION.themeId);
	evidence = $state('');
	dedication = $state('');
	voice = $state<MeechieStudioVoiceSettings>({ ...DEFAULT_STYLE_SELECTION.voice });
	pageSize = $state<PageSize>('US_Letter');
	border = $state<BorderChoice>('decorative');
	glitter = $state(DEFAULT_STYLE_SELECTION.glitter);
	/**
	 * The reader's choice of lettering size and room to colour, `null` per field for the studio's
	 * own default.
	 *
	 * A `ColoringPageSpec` control in the same sense as `pageSize` and `border`: it is a field of the
	 * page, it is stored with the page, and it comes back when the page is reopened — see
	 * `loadCreation`. It was neither settable nor even *effective* before this: both fields reached
	 * no prompt at all, so a page built at `large` and one built at `small` were the same picture.
	 */
	pageLook = $state<PageLookSelection>({ ...DEFAULT_PAGE_LOOK });
	/**
	 * Rewrites left for the verdict currently on screen. Refilled whenever a new verdict arrives —
	 * see `startRewriteRound`. Never the app's spend control; that is `aiQuota`.
	 */
	revisionBudget = $state(DEFAULT_REVISION_BUDGET);
	/**
	 * Every quota reading the server has sent this tab, one slot per bucket.
	 *
	 * `null` in a slot is shown as nothing at all. The counter this replaced invented a number the
	 * server had never agreed to — it said "3 AI text actions left" while the real gate allowed ten
	 * a minute and refilled every sixty seconds — so an unknown quota reads as silence rather than
	 * as a fresh guess.
	 *
	 * Two slots rather than one because this studio spends two different buckets and used to report
	 * only the first: the verdict and rewrite buttons spend `text` (20 units a minute), while the
	 * "make the page" button below them spends `image` (8 a minute, refilling on its own window).
	 * The single sentence that used to sit over both described `text` alone.
	 */
	readonly quota = new AiQuotaMeter({
		// Through a closure, not captured: `clock` is a settable accessor here and tests replace it
		// after construction.
		clock: () => this.clock
	});
	private verdictOnScreen = $state<MeechieStudioTextOutput | null>(null);
	/**
	 * Where the verdict on screen came from. Two separate questions turn on it, and conflating them
	 * was this change's own first defect — a review caught it.
	 *
	 * - `'reported'` — a live studio response, or a record carrying the `modelMetadata` stamp that
	 *   only a studio response can have. Its `qualityState` is Meechie's own.
	 * - `'stored'` — real words out of a record whose standing cannot be shown to be hers: a toolkit
	 *   page, whose `'ready'` `buildToolStudioText` must invent because `MeechieToolOutput` has no
	 *   such field, or a studio page written before the stamp existed. The words are kept; the
	 *   standing is not claimed.
	 * - `'derived'` — rebuilt from the page itself by `buildStudioTextFromSpec`, because the record
	 *   stored no text. No standing, and nothing to write down: every field of it comes from
	 *   `intent`, so storing it would add only the invented `'ready'`.
	 *
	 * See `warrantForRestoredVerdict`, which is where the first two are told apart.
	 */
	private verdictWarrant = $state<VerdictWarrant>('none');
	/**
	 * The verdict on screen. Read-only from outside on purpose.
	 *
	 * It was a plain field, and a plain field can be assigned without answering the question above —
	 * so the value and its provenance would be two things to remember instead of one. There are
	 * exactly two writers, `setVerdict` and `clearVerdict`, and neither can produce an inconsistent
	 * pair: the first takes a verdict and a required source, the second takes nothing. Assigning
	 * this property is a type error rather than a verdict of unknown origin.
	 */
	get textOutput(): MeechieStudioTextOutput | null {
		return this.verdictOnScreen;
	}
	/**
	 * The last failed text action, classified.
	 *
	 * The home studio's copy of the same three lines: an exception's own message went straight into
	 * the crimson box, so a reader who lost their connection here read `Failed to fetch` too.
	 */
	textFailure = $state<GenerationFailure | null>(null);
	/**
	 * The reader-facing sentence for the last text failure. Derived, so there is one writer.
	 *
	 * Read by the tests rather than by a surface, as on the other state classes.
	 */
	textError = $derived(this.textFailure?.message ?? '');
	/** The action of the last text ATTEMPT, so a retry re-runs the same one. */
	private lastTextActionId: StudioTextActionId | null = null;
	/**
	 * The last failed page generation on this studio, classified.
	 *
	 * The home studio's copy of the same defect: `/api/generate`'s exceptions went into the crimson
	 * box verbatim. `pageFailure` is the whole story of that call; `generationError` below is the
	 * sentence derived from it, and the local refusals that never reach a provider classify through
	 * here too, as `request_rejected`, which is exactly what they are.
	 */
	pageFailure = $state<GenerationFailure | null>(null);
	/**
	 * Counts classifications on this studio, so the newest live failure can be identified.
	 *
	 * System Trace shows one diagnostic and this studio has three failures that can be live at once,
	 * so something has to say which one it is about. That was `pageFailure?.detail ??
	 * textFailure?.detail ?? null` at the call site, and a fixed order cannot answer it: a text
	 * failure followed by a try-on failure leaves both set, and so does a try-on failure followed by
	 * a text failure. Whichever field is listed first wins both times, so it names the stale one in
	 * exactly one of them — and the panel is where a reader goes to find out what just went wrong.
	 *
	 * A stamp written *onto* each classified failure by `recordFailure`, rather than a
	 * `lastClassified` field compared by identity against the three. Identity is not available here:
	 * `$state` deep-proxies whatever is assigned to it, so two fields holding the same object return
	 * two different proxies of it and `===` is false between them — Svelte says so out loud, as
	 * `state_proxy_equality_mismatch`. Reading a property through a proxy is unaffected, which is why
	 * a stamp works where identity does not. It also needs no synchronising with the many
	 * `pageFailure = null` writes scattered through this class: a field holding nothing is skipped,
	 * and a field still holding a failure still carries its own stamp.
	 *
	 * Not `$state`: it is never read during rendering, only written onto values that are.
	 */
	private failureStamp = 0;
	/**
	 * The stamp the current packaging attempts were installed at, or `0` when none has failed.
	 *
	 * `$state` because `traceFailureDetail` derives from it. Ordering packaging against the three
	 * classified failures is what stops a stale `textFailure` — which survives a page generation,
	 * because neither `handleGeneratePage` nor `resetGeneratedPage` clears one — from masking the
	 * packaging diagnostic beside the very notice reporting it.
	 */
	private packagingFailureStamp = $state(0);
	/**
	 * Which of the two page generators was last attempted, so a retry runs the same one.
	 *
	 * The studio makes pages two ways — from Meechie's words, and from a wig try-on portrait — and
	 * they are different requests with different costs. A single retry that always ran the verdict
	 * path would silently swap a reader's try-on page for a quote page, and charge them a generation
	 * for it.
	 *
	 * Unlike the other surfaces there is no attempted *source* pinned beside it: this studio builds
	 * its page from the live controls, which are all on screen and all visible to the reader, so
	 * "again" honestly means "with what is showing".
	 */
	private lastPageAttempt: 'page' | 'tryOn' | null = null;
	generationError = $derived(this.pageFailure?.message ?? '');
	/**
	 * The studio's autosave, when it fails.
	 *
	 * Was `draftSaveError: string`, holding either the seam's message or a caught exception's, and
	 * rendered as `Draft not saved: {that string}`. So a reader whose browser blocks site data was
	 * told "Draft not saved: Creation store requires a browser environment."
	 */
	draftSaveFailure = $state<StorageFailure | null>(null);
	/**
	 * Re-run the autosave that failed.
	 *
	 * Takes no arguments and re-reads the live spec on purpose, unlike the vault's retries: a draft
	 * is by definition whatever is on screen now, so retrying with a snapshot of what was on screen
	 * when the save failed would write a stale draft over the reader's newer work.
	 *
	 * No `isBusy` flag accompanies it: `isSavingDraft` is a plain field rather than `$state`, so a
	 * getter over it would not re-render, and `saveDraft` already coalesces a re-entrant call into
	 * `isDraftSavePending` — a double press queues one more save rather than racing two.
	 */
	retryDraftSave = (): void => {
		void this.saveDraft();
	};
	/**
	 * A Page Controls change that could not be applied.
	 *
	 * Its own field, because it used to be written to `draftSaveError` — rendered in the *evidence*
	 * panel, prefixed "Draft not saved:". A theme that failed to apply was therefore reported as a
	 * draft problem, on a different panel, while the control the reader had just moved said nothing.
	 */
	settingsError = $state('');
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
	validationIssues = $state<SpecValidationOutput['issues']>([]);
	/**
	 * The Page Controls panel is the thing currently answering for the spec's check.
	 *
	 * Set by `syncSpecFromCurrentText` once its rebuild returns, and dropped by `validateSpec` the
	 * moment any check begins — including the one inside that same rebuild, which is why the set
	 * comes after. So the panel speaks for the check it caused and stops speaking the instant
	 * anything else re-checks the spec, without every other caller having to remember to say so.
	 */
	private settingsReported = $state(false);
	/**
	 * What the spec check found wrong after a Page Controls change, in the reader's words.
	 *
	 * `settingsError` above covers only the case where the check could not be *run* — an adapter
	 * rejection, which is the rare one. An ordinary contract failure resolves normally with
	 * `{ ok: false, issues }`, and `applyTextToSpec` awaited that result and dropped the boolean, so
	 * the common failure went on appearing solely in System Trace: a Page Controls change reported
	 * in a panel about the provider, which is precisely what this run took `draftSaveError` out of.
	 *
	 * Mirroring `validationIssues` wholesale would park a generation's or a reopen's findings under
	 * the settings panel, blaming the controls for something that happened before the reader touched
	 * them. So it is `validationIssues` *while the panel is the one answering*, and empty otherwise.
	 *
	 * Derived rather than copied, which is the second correction this field has needed. It was a
	 * `$state` written by the panel's handler, and a copy taken at one moment cannot follow its
	 * source: an over-long dedication reported here, then *fixed* in the dedication box, revalidated
	 * and cleared `validationIssues` and left this saying the page had failed a check it now passed.
	 * A copy that drifts from what it copied is the defect this whole run is about, and it was in
	 * the reporting itself.
	 *
	 * The first correction was the writer, not the value. The doc here claimed "written only by the
	 * panel's own handler" while the wig selector and the try-on page generator both called that
	 * handler, and the try-on path left a finished, valid page reporting a failure about the
	 * intermediate spec it had already thrown away. They call `rebuildSpecFromCurrentText` instead.
	 * Between the split and the derivation, neither the wrong caller nor a stale moment can write
	 * here, because nothing writes here at all.
	 */
	settingsIssues = $derived(
		this.settingsReported ? this.validationIssues.map((issue) => issue.message) : []
	);
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
	 * Its own field because it is a fact about the *restore*, not about an artifact. Only the two
	 * restore paths set it and only `resetGeneratedPage` clears it, so every path that replaces the
	 * paper clears it exactly once.
	 */
	private restoredStyleUnknown = $state(false);
	/**
	 * The reader picked a style control since the restore, whatever it changed.
	 *
	 * The whole answer to "has the reader chosen a style for a page that recorded none?", and it took
	 * three review rounds to get here because the first answer was a *comparison* — the live
	 * selection against the controls as restored — with flags bolted on for the cases a comparison
	 * cannot see. Each round found another: re-picking the active theme, re-picking the active wig,
	 * and finally moving Rawness and putting it back. All three are the reader choosing, and all
	 * three leave the values identical.
	 *
	 * The comparison existed for one reason: page size and border reach the studio through the same
	 * handler as the voice and glitter, and they are not style — they live in the intent. Giving the
	 * style controls their own `SettingChangeSource` removes that reason, and with it the entire
	 * class of edge cases. Touching a style control is the claim; nothing is inferred from values.
	 *
	 * The lesson, since it cost four rounds: when the fix for a rule keeps being another special
	 * case, the rule is asking the wrong question. This one was asking "did the values change?" when
	 * what it needed to know was "did the reader choose?" — and only the caller knows that.
	 */
	private readerClaimedStyle = $state(false);
	/**
	 * The reader has chosen a style for a restored page that recorded none.
	 *
	 * Two conditions, and the second is the one that keeps this from undoing the rest of the change.
	 *
	 * A style control has moved since the restore — compared against the baseline rather than
	 * inferred from the panel firing, because page size and border come through the same handler and
	 * are not style. Moving those would otherwise write the untouched defaults down as a choice,
	 * which is the invention this whole field exists to prevent.
	 *
	 * And there is no artifact on the paper. With a picture up, the controls do not get to claim its
	 * provenance no matter how deliberately they were moved — that is the defect this run started
	 * from. Without one, the controls are the only author there is.
	 */
	private readerChoseStyleSinceRestore = $derived(
		this.generatedSpec === undefined && this.readerClaimedStyle
	);
	/**
	 * True when the page on the paper has no style of its own on file.
	 *
	 * The restore's answer, until the reader gives a better one. Reported unchanged for a page that
	 * has a picture, because there the reader cannot give one without regenerating.
	 *
	 * The second clause is a review's, and it was right against my own decline of it: without it, a
	 * draft written before styles were stored could never acquire one. Every autosave wrote
	 * `undefined`, so every refresh threw away the theme the reader had just picked — permanently,
	 * and on a page with no picture whose look is entirely that choice. "Never invent provenance"
	 * had quietly become "never record it", which is a different rule and a worse one.
	 */
	styleSelectionUnknown = $derived(this.restoredStyleUnknown && !this.readerChoseStyleSinceRestore);
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
	/**
	 * True when the drift check has actually reported on the page currently on the paper.
	 *
	 * This exists because `violations.length === 0` answers two opposite questions with the same
	 * value: "the check ran and found nothing" and "no check has run". System Trace read it as the
	 * first and so told a reader who had generated nothing that their page was clean.
	 *
	 * It cannot be derived. Every candidate proxy is wrong in a case that actually happens:
	 * `images.length > 0` misses the generation that returns words without a picture, which assigns
	 * the trace above that guard on purpose so the findings survive; `assembledPrompt !== ''` is
	 * true for a reopened record whose findings were never stored. So it is written explicitly, at
	 * exactly the three sites that already write `violations`, and nowhere else.
	 */
	private driftReported = $state(false);
	/** Why the drift check returned no verdict, when `/api/generate` said it returned none. */
	private driftCheckFailure = $state<GenerateResponseValue['driftCheckFailure']>(undefined);
	/**
	 * True when the page on screen came out of the vault without its check result.
	 *
	 * Set only by `loadCreation`. Deliberately not derived from "there is a page and no drift result":
	 * a wig try-on page is installed without ever calling `/api/generate` and matches that shape
	 * exactly, and was being told it had been saved before its result was recorded — about a page
	 * that had never been saved at all.
	 */
	private checkResultUnrecorded = $state(false);
	/**
	 * True when `assembledPrompt` was actually sent to a provider.
	 *
	 * The try-on path writes a human description into `assembledPrompt` only because a vault record
	 * requires a non-empty one; no request is made. Without this, System Trace filed that description
	 * under "What Was Sent".
	 */
	promptWasSent = $state(false);
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
	isSaving = $state(false);
	/**
	 * The last failed vault save, classified.
	 *
	 * Held alongside `vaultStatus` rather than replacing it, because the status line carries the
	 * *confirmation* too and `vaultLinkFor` decides its link by matching that sentence exactly. This
	 * field is what lets the line offer a retry, and what holds the seam's own words for System
	 * Trace instead of putting them on screen.
	 */
	vaultSaveFailure = $state<StorageFailure | null>(null);

	// --- Quote Vault state ---
	/**
	 * The saved pages themselves, and every operation on the collection of them.
	 *
	 * Held rather than implemented, because the vault is not the studio's. It used to be: the list,
	 * the search, the pin, the two-step delete and the undo were all fields and methods on this
	 * class, which is why the only surface in the app that could show a reader their saved pages
	 * was the one page that instantiates it. Everything below this line forwards, so `/vault` and
	 * the home card are one implementation and cannot answer the same question two ways.
	 *
	 * What did *not* move is `saveToVault` and `loadCreation`. Writing a record needs the page on
	 * screen, and reopening one has to put a spec, an image and a set of controls back — both are
	 * studio operations that happen to end at the vault.
	 */
	vault = new VaultCollection();
	/**
	 * Whether the home card is showing every match or the first few.
	 *
	 * The one piece of vault state that genuinely belongs to this surface and not to the vault: the
	 * home card is a preview inside a studio, and `/vault` shows everything by definition.
	 */
	vaultShowAll = $state(false);

	// --- The vault's own state, forwarded ---
	// Accessors rather than copies. A copy would be a second source of truth for the same pages,
	// and the whole defect this replaces is one source of truth that only one surface could read.
	get creations(): CreationRecord[] {
		return this.vault.creations;
	}
	set creations(value: CreationRecord[]) {
		this.vault.creations = value;
	}
	get vaultQuery(): string {
		return this.vault.query;
	}
	/**
	 * The vault's last failure, in the words the reader gets.
	 *
	 * Was `vaultError: string`, forwarding the seam's own message. See
	 * `src/lib/core/storage-failure.ts`.
	 */
	get vaultFailure(): StorageFailure | null {
		return this.vault.failure;
	}
	get vaultFailedOperation(): StorageOperation {
		return this.vault.failedOperation;
	}
	get retryVaultOperation(): (() => Promise<void>) | null {
		return this.vault.retryFailedOperation;
	}
	get vaultReadFailed(): boolean {
		return this.vault.readFailed;
	}
	get vaultStatus(): string {
		return this.vault.status;
	}
	set vaultStatus(value: string) {
		// Any status that is not this failure's own sentence has replaced it, and the failure — with
		// the retry it arms — has to go with it. Enforced here rather than at each assignment because
		// there are five of them and a sixth would forget: reopening a saved page sets "Reopened
		// ..." and used to leave "Save it again" sitting under it, where pressing it saved the page
		// just reopened rather than the one whose save had failed.
		//
		// The save path sets `vaultSaveFailure` BEFORE assigning its message here, so this comparison
		// sees them equal and keeps the failure. Every other assignment clears it.
		if (value !== this.vaultSaveFailure?.message) this.vaultSaveFailure = null;
		this.vault.status = value;
	}
	get pendingDeleteId(): string | null {
		return this.vault.pendingDeleteId;
	}
	get undoableDeletion(): CreationRecord | null {
		return this.vault.undoableDeletion;
	}
	// The clock behind the "Saved today / 3 days ago" labels, and — through `nowMs` — behind the
	// mode spotlight too. `AGENTS.md` classifies clock/time as a seam, so both the reads and the
	// day-boundary timer cross `ClockSeam` rather than calling `Date.now()` or `setTimeout`.
	// Injectable so a test drives the rollover instead of waiting for real midnight.
	get clock(): ClockSeam {
		return this.vault.clock;
	}
	set clock(value: ClockSeam) {
		this.vault.clock = value;
	}
	// Clock reading behind the labels. Held as state and refreshed at each day boundary and on each
	// vault reload, so the labels stay a pure function of an explicit instant rather than
	// re-reading the clock inside a $derived on every keystroke.
	get nowMs(): number {
		return this.vault.nowMs;
	}
	set nowMs(value: number) {
		this.vault.nowMs = value;
	}
	// Reads the origin the app is served from, used to decide whether a stored absolute image URL
	// is same-origin and therefore loadable under the app's `img-src 'self'` CSP. Behind a seam for
	// the same reason as the clock: reading `location` here would be an unseamed browser
	// integration, and the same-origin decision could not be driven from a test.
	get origin(): AppOriginSeam {
		return this.vault.origin;
	}
	set origin(value: AppOriginSeam) {
		this.vault.origin = value;
	}
	// Tells the studio when a backgrounded tab comes back. Behind a seam for the same reason as the
	// clock: reading `document.visibilityState` and subscribing to `visibilitychange` here would be
	// an unseamed browser integration, reachable from a test only by dispatching a real DOM event.
	get visibility(): PageVisibilitySeam {
		return this.vault.visibility;
	}
	set visibility(value: PageVisibilitySeam) {
		this.vault.visibility = value;
	}
	get appOrigin(): string {
		return this.vault.appOrigin;
	}
	set appOrigin(value: string) {
		this.vault.appOrigin = value;
	}

	// --- Wig try-on state ---
	selectedWig = $state<Wig | null>(null);
	// Derived, not stored. Trying a wig on now needs the whole wig — the portrait is filed under it
	// and labelled with its name — so a separately assigned id would be a second source of truth
	// for "which wig is on screen", free to disagree with the first.
	selectedWigId = $derived(this.selectedWig?.id ?? null);
	selfieBase64 = $state('');
	selfieMimeType = $state<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
	isTryingOn = $state(false);
	/**
	 * The one failed try-on the reader is currently being told about, classified.
	 *
	 * This was a bare `string` holding whatever the request threw, rendered in a crimson box: an
	 * offline attempt read `Failed to fetch`, a bad gateway read
	 * `postJson: HTTP 502 Bad Gateway from /api/wig-try-on: empty response body`, and a rate-limit
	 * refusal said "the current window" a few pixels below a meter that already knew the instant.
	 * It was the last of the app's eight `postJson` call sites still doing that, months after
	 * `TRY_ON_SUBJECT` and eight `WIG_TRY_ON_*` cause mappings were written for it and left unused.
	 */
	tryOnFailure = $state<GenerationFailure | null>(null);
	/**
	 * The reader-facing sentence for the last try-on failure. Derived, so there is one writer.
	 *
	 * Read by the tests rather than by a surface, exactly as `textError` is: the panel takes the
	 * whole failure, because it needs the retry advice as well as the words.
	 */
	tryOnError = $derived(this.tryOnFailure?.message ?? '');
	/**
	 * The raw diagnostic System Trace renders under "What Went Wrong Underneath", or `null`.
	 *
	 * Declared here rather than beside `failureStamp`, which is where it belongs by subject: a
	 * `$derived` is evaluated in field order, and `tryOnFailure` is declared further down the class,
	 * so up there it would read a field that does not exist yet.
	 *
	 * The newest *live* failure wins, so a failure that has been cleared stops being explained the
	 * moment it leaves the screen, and an older one still on screen is described rather than
	 * ignored. Ties go to the order listed, which only arises between failures that never went
	 * through `recordFailure` and so carry no stamp at all.
	 */
	/**
	 * The technical detail System Trace shows under "What Went Wrong Underneath".
	 *
	 * Packaging is included, and it was the gap: `PageExportRow` never renders `failure.detail`, on
	 * purpose, so once packaging stopped writing its raw string onto the screen the diagnostic had
	 * **no consumer anywhere** and disappeared entirely. It is read last because the three stamped
	 * failures are ordered against each other by `newestFailure` and a packaging failure carries no
	 * stamp to join that ordering — and because a page that failed to generate has no packaging
	 * attempt to report, so the two are not in practice competing.
	 */
	traceFailureDetail = $derived.by((): string | null => {
		const packaging = pageExportFailureDetail(this.packageAttempts);
		const classified = newestFailure([
			this.pageFailure,
			this.textFailure,
			this.tryOnFailure
		]);
		if (packaging === null) return classified?.detail ?? null;
		if (classified === null) return packaging;
		// Ordered, not preferred. A packaging failure is stamped from the same counter the three
		// classified ones use, so "most recent" means the same thing for all four.
		return this.packagingFailureStamp > stampOf(classified)
			? packaging
			: (classified.detail ?? packaging);
	});
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
	/**
	 * Resolved against the whole catalogue, not against a rotating subset of it.
	 *
	 * The previous version searched the three modes on the strip and fell back to the first of
	 * them. That fallback is silent, and it is the studio changing the reader's question: the id
	 * would still say one mode while the heading, help, placeholder, button and `toolId` all came
	 * from another. It could not fire while the only way to pick a mode was the same three cards —
	 * but that is exactly the condition this run removed, so resolving against `studioModes` is
	 * what makes the other five safe to select.
	 */
	activeMode = $derived(
		this.modes.find((m) => m.id === this.activeModeId) ?? this.modes[0]
	);
	/**
	 * Which modes are called out right now and when that stops being true, or `null` when the app
	 * is not in a position to say.
	 *
	 * Two things are going on here, and the `null` is the more important one.
	 *
	 * `null` before hydration, because `/` is prerendered once: any dated claim baked into that
	 * HTML is a claim about the *build*, and the service worker caches that document and replays it
	 * for days. Both the badges and `spotlightNote` are gated on this one value rather than each
	 * re-testing `isBrowser`, so there is no second copy of the rule to drift. Every mode's card and
	 * `/m/` link is in the prerendered markup either way — a crawler, a reader with JavaScript off
	 * and an installed app opening from cache all still get the complete menu. They get it without
	 * a spotlight, which is the honest rendering of a document that cannot know today's date.
	 *
	 * Derived from `nowMs` rather than read from the clock here, so it inherits the refresh the
	 * vault labels already have: `startSavedLabelRefresh` moves `nowMs` at every UTC day boundary
	 * and whenever a backgrounded tab comes back. Every instant a spotlight can change on — a
	 * Monday, a first-of-month — is a UTC day boundary, so that timer already fires on each of them
	 * and no second one is needed.
	 */
	spotlight = $derived<ModeSpotlight | null>(
		this.isBrowser ? getModeSpotlight(this.nowMs) : null
	);
	/** The sentence under the strip explaining the badges, or `''` when there are none to explain. */
	spotlightNote = $derived(
		this.spotlight ? describeSpotlightSchedule(this.spotlight) : ''
	);
	activeTheme = $derived(
		studioThemes.find((t) => t.id === this.selectedThemeId) ?? studioThemes[0]
	);
	previewOutput = $derived(this.textOutput);
	/**
	 * Everything the verdict card shows about the answer on screen.
	 *
	 * Built here rather than in the component so the card renders a value instead of computing one,
	 * and so every rule about what may be claimed — that an unreported standing claims nothing, that
	 * an absent rating shows nothing, that a whitespace note is no note — is unit-tested in
	 * `verdict-report.ts` rather than in markup.
	 */
	verdictReport = $derived(
		buildVerdictReport({
			output: this.textOutput,
			standingWasReported: this.verdictWarrant === 'reported'
		})
	);
	/**
	 * What the server said about this caller's quota, in a sentence, or `''` when it has not said
	 * anything yet.
	 *
	 * The reset instant is rendered as a clock time rather than a countdown because nothing here
	 * re-renders on a tick: "ready in 34s" would be wrong 34 seconds later, and this meter exists
	 * precisely because the old one said things that were not true.
	 */
	// Seconds are shown, not rounded away: the window is sixty seconds long, so a bucket that
	// refills at 3:42:55 rendered as "3:42" invites the reader to retry most of a minute early and
	// be refused. A quota label that is wrong by nearly a whole window is the defect this feature
	// exists to remove, not one to reintroduce in the formatting.
	/**
	 * The text bucket's sentence — verdicts and rewrites.
	 *
	 * Named `verdict` rather than the old generic `AI call` because there are now two of these lines
	 * on screen and a coloring page is also an AI call: "3 AI calls left" above "2 pages left" reads
	 * as one number contradicting the other, when in fact they are two independent buckets. The noun
	 * is what tells the reader which one just ran out.
	 */
	aiQuotaMessage = $derived(
		this.quota.textMessage({
			actionNoun: 'verdict or rewrite',
			actionNounPlural: 'verdicts or rewrites'
		})
	);
	/**
	 * The sentence for the bucket the "make the page" button actually spends.
	 *
	 * Separate from `aiQuotaMessage` because the buckets are separate. Running out of verdicts and
	 * running out of pages are different events, on different windows, and a reader who has one left
	 * and not the other can only act on that if the studio says which.
	 */
	pageQuotaMessage = $derived(this.quota.pictureMessage(this.spec?.variations ?? 1));
	/**
	 * The server will refuse the next coloring page.
	 *
	 * The image-bucket twin of `aiQuotaExhausted`, which gates the verdict and rewrite buttons and
	 * reads the text bucket. Two buttons, two buckets, two gates — a single one would disable the
	 * wrong control.
	 */
	pageQuotaExhausted = $derived(
		this.quota.pictureExhausted(this.spec?.variations ?? 1)
	);
	/** What the image bucket has left, counted in try-ons rather than in pages. */
	tryOnQuotaMessage = $derived(
		// Named "try-on", not "page". Both cost one unit of the same bucket, so the arithmetic
		// matched either way — but the label would have told a reader under the Try On button how
		// many *pages* they had left, which is a different action from the one that button spends.
		this.quota.pictureMessage(WIG_TRY_ON_QUOTA_COST, 'try-on')
	);
	/** The image bucket also funds wig try-ons, so the try-on control answers to it too. */
	tryOnQuotaExhausted = $derived(
		this.quota.pictureExhausted(WIG_TRY_ON_QUOTA_COST)
	);
	/**
	 * The server has told us, and not yet un-told us, that it will refuse the next AI call.
	 *
	 * Only ever true while a reading is both present and unexpired — the expiry timer nulls the
	 * snapshot at the reset instant, so this cannot outlive the window it came from. `null` means
	 * "not known", which never blocks anything: the studio refuses a click only on a server
	 * statement it currently holds, never on a guess.
	 *
	 * It exists because a panel that says the desk is full above buttons that still submit is the
	 * same disagreement between the screen and the server that this whole feature was written to
	 * end — the sentence and the guard have to be reading the same number.
	 */
	aiQuotaExhausted = $derived(this.quota.textExhausted());
	canGenerateText = $derived(
		!this.aiQuotaExhausted &&
			canRunStudioAction('generate_text', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canRegenerateText = $derived(
		!!this.textOutput &&
			!this.aiQuotaExhausted &&
			canRunStudioAction('regenerate', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakePrettier = $derived(
		!!this.textOutput &&
			!this.aiQuotaExhausted &&
			canRunStudioAction('make_prettier', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakeMeaner = $derived(
		!!this.textOutput &&
			!this.aiQuotaExhausted &&
			canRunStudioAction('make_meaner', {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
	);
	canMakeMoreSpecific = $derived(
		!!this.textOutput &&
			!this.aiQuotaExhausted &&
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
	/**
	 * What System Trace says about the page on the paper.
	 *
	 * Derived rather than assigned, so it cannot lag the four facts it reports on. Built by the
	 * dependency-free core so the same transform — and the same refusal to call an unchecked page
	 * clean — is available to the mode routes, which build their own from the same function.
	 */
	/**
	 * Read by `qualityReport` above its own declaration, which a field reference cannot do.
	 *
	 * `tryOnPageOnScreen` is declared far below with the rest of the try-on state, and a `$derived`
	 * initialiser referencing a later field is a use-before-initialisation error. A getter is
	 * evaluated when the derived runs, not when the class is constructed, so the ordering stops
	 * mattering — and the flag stays where it is documented.
	 */
	private get pageIsTryOnPortrait(): boolean {
		return this.tryOnPageOnScreen;
	}
	qualityReport = $derived(
		buildQualityReport({
			// Two separate facts, deliberately. `images.length > 0` is whether there is a page;
			// `driftReported` is whether the check spoke about it. Passing the second as both — the
			// first draft of this — reported a picture-less generation as "came back exactly as
			// asked", and a reopened legacy record as "nothing on the paper yet" while its page was
			// on screen.
			hasPage: this.images.length > 0,
			driftChecked: this.driftReported,
			violations: this.violations,
			recommendedFixes: this.recommendedFixes,
			driftCheckFailure: this.driftCheckFailure,
			checkResultUnrecorded: this.checkResultUnrecorded,
			// A try-on portrait is installed without a prompt, so no drift check is coming for it —
			// which is a different thing from one not having arrived yet.
			checkApplicable: !this.pageIsTryOnPortrait,
			validationIssues: this.validationIssues
		})
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
	 * True while `rebuildPageExports` is running, so the control cannot be double-fired.
	 *
	 * Its own flag rather than `isGenerating`: a rebuild buys no generation, and reusing that flag
	 * would disable every paid button in the studio and put the panel into the state a reader reads
	 * as "it is making my page again".
	 */
	isRebuildingDownloads = $state(false);
	canTryOn = $derived(
		!!this.selectedWigId &&
			!!this.selfieBase64 &&
			!this.isTryingOn &&
			!this.tryOnQuotaExhausted
	);
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
	vaultEntries = $derived(this.vault.entries);
	/**
	 * What the card says about how much is in the vault, in the same words `/vault` uses.
	 *
	 * Two numbers kept apart: how many pages are saved, and how many the current search matches.
	 * The card used to render only the first, so searching left "12 saved" above three rows.
	 */
	vaultCountLabel = $derived(
		describeVaultCount(this.creations.length, this.vaultEntries.length, this.vaultQuery)
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
	undoableDeletionEntry = $derived(this.vault.undoableDeletionEntry);

	// --- Non-reactive implementation details ---
	// Whose pages these are, forwarded like the rest: `saveToVault` files a record under the same
	// owner the collection lists by, and two independently derived owners would file and list
	// different sets.
	get owner(): CreationOwner | null {
		return this.vault.owner;
	}
	set owner(value: CreationOwner | null) {
		this.vault.owner = value;
	}
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
	// `$state`, not a plain field: `qualityReport` derives from it, and a plain class field is not
	// reactive in runes mode — the report would have been computed once and then never followed the
	// paper changing from a portrait to a generated page or back.
	private tryOnPageOnScreen = $state(false);

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
		// `'derived'` text is text this studio rebuilt from the page itself, and every field of it —
		// verdict, quote, title, items — comes from `intent` by way of `buildStudioTextFromSpec`.
		// Writing it back would add nothing the record does not already hold except the `'ready'`
		// that function had to invent. So a record that stored no studio text keeps storing none, and
		// the words come back the same way they came out.
		//
		// Keyed on `'derived'` and not on "was the standing reported": `'stored'` text is somebody's
		// real words — a verdict is not usually its page title — and dropping it to avoid carrying a
		// standing nobody believes anyway would lose the page's own sentences. Those are two
		// questions, and answering both with one flag was this change's first defect.
		if (this.verdictWarrant === 'derived') return undefined;
		return $state.snapshot(this.textOutput);
	}

	/**
	 * The only way a verdict is put on screen.
	 *
	 * `source` is required and has no default, so a caller cannot put a verdict up without saying
	 * where it came from — the value and its provenance are one fact, and two assignment sites are
	 * two chances to set one and forget the other. `null` has its own writer below rather than being
	 * a case here, so no call can pair "there is no verdict" with a source that says there is one.
	 */
	private setVerdict(
		value: MeechieStudioTextOutput,
		warrant: Exclude<VerdictWarrant, 'none'>
	): void {
		this.verdictOnScreen = value;
		this.verdictWarrant = warrant;
	}

	/**
	 * A verdict Meechie just gave. Its `qualityState` is hers, whatever it says.
	 *
	 * Also the arrangement a test reaches for when it wants "a verdict is on screen": that is what a
	 * reader has after pressing the button, and it is the state in which the card is entitled to
	 * repeat what she said about it.
	 */
	acceptVerdict = (value: MeechieStudioTextOutput): void => {
		this.setVerdict(value, 'reported');
	};

	/** Nothing on the paper and nothing said about it. */
	private clearVerdict(): void {
		this.verdictOnScreen = null;
		this.verdictWarrant = 'none';
	}

	/**
	 * A verdict brought back from a record or a draft, which may be nothing at all — a page with no
	 * printed items restores no text. `stored` is the record's own `studioText`, or `undefined` when
	 * it saved none; `warrantForRestoredVerdict` reads the provenance stamp off it.
	 */
	private restoreVerdict(
		value: MeechieStudioTextOutput | null,
		stored: MeechieStudioTextOutput | undefined
	): void {
		if (value === null) this.clearVerdict();
		else this.setVerdict(value, warrantForRestoredVerdict(stored));
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
	/**
	 * The same idea for the *verdict*, which has a life of its own: the page can be replaced without
	 * the verdict changing, and a round can be abandoned while its request is still in flight.
	 *
	 * Incremented whenever the reader walks away from the round a request was made for — a mode
	 * switch, a reopened saved page. `runTextAction` captures it and drops a reply that belongs to a
	 * round nobody is looking at any more, which otherwise lands the previous mode's verdict on the
	 * new one and charges the new round's allowance for it.
	 */
	private verdictToken = 0;
	private draftTimer: ReturnType<typeof setTimeout> | null = null;
	private isSavingDraft = false;
	private isDraftSavePending = false;

	// --- Private helpers ---

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
		this.draftSaveFailure = null;
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
			this.draftSaveFailure = result.ok ? null : classifyStorageFailure('draft', result.error);
		} catch (error) {
			// Was `error instanceof Error ? error.message : 'Draft save failed'` — a caught
			// exception's own words, rendered under the label "Draft not saved:". See
			// `src/lib/core/storage-failure.ts`.
			this.draftSaveFailure = classifyStorageFailure('draft', error);
		} finally {
			this.isSavingDraft = false;
			if (this.isDraftSavePending) {
				this.isDraftSavePending = false;
				void this.saveDraft();
			}
		}
	}

	private async validateSpec(): Promise<boolean> {
		// A fresh check begins, so whatever the panel was saying about the last one stops being an
		// answer about the current spec. Here rather than in each non-panel caller: the leak this
		// replaces was one caller forgetting, and a rule enforced at the one place every check goes
		// through cannot be forgotten by a caller added later. `syncSpecFromCurrentText` sets it
		// back after its own rebuild returns, which is after this has run.
		this.settingsReported = false;
		// Same reasoning, one field over. This one says the last Page Controls change could not be
		// *checked*; a check that is now running says otherwise.
		this.settingsError = '';
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
		// The reopened page's presentation, minus the two fields that are now reader controls. They
		// are passed separately below off `pageLook`, and leaving them in here as well would make the
		// carried-forward copy win over the control the reader had just moved.
		const { textSize: _restoredTextSize, whitespaceScale: _restoredWhitespace, ...restoredPresentation } =
			this.spec;
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
					? { ...restoredPresentation, decorations: undefined }
					: restoredPresentation
				: undefined,
			// Not in `presentation`, and not conditional on `restoredPageLayout`: these two are
			// reader controls now, exactly like `pageSize` and `border` two lines up. Carrying them
			// forward from the reopened page instead would make the Page Controls panel unable to
			// change them, which is the state they were already in for the app's whole life.
			// `?? undefined` because `null` here means "no override", and the builder's own default
			// is what answers that.
			textSize: this.pageLook.textSize ?? undefined,
			whitespaceScale: this.pageLook.whitespaceScale ?? undefined
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
		this.pageFailure = null;
		this.assembledPrompt = '';
		this.revisedPrompt = '';
		this.violations = [];
		this.recommendedFixes = [];
		this.driftReported = false;
		this.driftCheckFailure = undefined;
		this.checkResultUnrecorded = false;
		this.promptWasSent = false;
		this.images = [];
		// Clears the packaged files, the described export row and the export failure sentence in one
		// assignment, because all three are derived from it. `pageExports` also loses the provider's
		// own image through `this.images` above, so nothing from the previous page can be left behind
		// in the row.
		this.packageAttempts = [];
		// Cleared here as well as in `rebuildPageExports`'s own `finally`, because that `finally` may
		// never run: the packaging adapter awaits `image.onload`/`onerror` with no timeout, so a
		// rebuild that hangs never settles and would leave the next page's rebuild button disabled by
		// an operation nobody is waiting for.
		this.isRebuildingDownloads = false;
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
		this.settingsReported = false;
		// A fact about the page being replaced, so it goes with it. `loadCreation` calls this first
		// and sets it after, which is the same order the two artifact snapshots above use.
		this.restoredStyleUnknown = false;
		// Goes with the flag it qualifies: left standing, the claim would carry a choice made about a
		// page that is no longer here.
		this.readerClaimedStyle = false;
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
		this.tryOnFailure = null;
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
		await this.vault.refresh();
	}

	// --- Public action handlers ---
	// Arrow functions ensure stable `this` binding when passed as component callbacks.

	/**
	 * Give the verdict now on screen its own full rewrite allowance.
	 *
	 * Called from every path that replaces what the reader is looking at with something they have
	 * not reworked yet: a generated verdict, a mode switch, a reopened saved page. Without it the
	 * allowance was per tab-load and never came back, so spending it on one mode's verdict left the
	 * next mode — whose verdict the switch had just deleted — with every AI button disabled and a
	 * message about "this page" that referred to a page no longer on screen.
	 */
	private startRewriteRound(): void {
		this.revisionBudget = DEFAULT_REVISION_BUDGET;
	}

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
		this.clearPagelessRequestDiagnostics();
		await this.applyTextToSpec(this.rebuildSourceText(), source);
	};

	/**
	 * Drop the findings and the trace of a generation that put nothing on the paper, because the
	 * request they describe is no longer the one the controls describe.
	 *
	 * A generate response can be contract-valid, carry findings, and carry no usable image. Those
	 * diagnostics are the most useful thing on screen at that moment — which is why the generate path
	 * records them above its no-picture guard — but they belong to a REQUEST, and the studio had no
	 * path that retired them. Every reset here hangs off replacing the *page*, and there is no page,
	 * so moving the paper size or retyping the dedication left the previous prompt's report and trace
	 * under controls that no longer describe it.
	 *
	 * The `images` guard is the whole safety of this. With a page on screen the report belongs to that
	 * page and must survive every control change untouched: the studio deliberately keeps a finished
	 * page and its trace while the reader sets up the next one, and dropping the report of the page
	 * they are looking at would be the same defect pointed the other way. Nothing here runs during a
	 * generation either — `resetGeneratedPage` has already cleared all of it before the request goes
	 * out, so every field below is a no-op until a completed request leaves one set.
	 */
	private clearPagelessRequestDiagnostics(): void {
		if (this.images.length > 0) return;
		this.pageFailure = null;
		this.assembledPrompt = '';
		this.revisedPrompt = '';
		this.violations = [];
		this.recommendedFixes = [];
		this.driftReported = false;
		this.driftCheckFailure = undefined;
		this.checkResultUnrecorded = false;
		this.promptWasSent = false;
	}

	/**
	 * The Page Controls panel's handler: rebuild the spec, then report the outcome beside the
	 * control the reader just moved. The only writer of `settingsError` and `settingsIssues`.
	 */
	syncSpecFromCurrentText = async (
		source: SettingChangeSource = 'setting'
	): Promise<void> => {
		this.settingsError = '';
		this.settingsReported = false;
		try {
			await this.rebuildSpecFromCurrentText(source);
			// `applyTextToSpec` has already run the check and stored what it found, so the panel
			// reads that answer rather than paying for a second call to the seam that could
			// disagree with the first. Claiming the check rather than copying its result: the issues
			// the reader sees are `validationIssues` itself from here on, so a later fix to the spec
			// that clears them clears the panel too instead of leaving it insisting on a failure the
			// page no longer has.
			this.settingsReported = true;
			// A theme click is the reader naming a style even when it changes nothing measurable, so
			// it is recorded here rather than inferred from the values. Only on a rebuild that
			// succeeded: a click whose spec did not survive its own check has not authored anything.
			// `selectWigForTryOn` sets the same flag for the same reason — see there.
			if (source !== 'setting') {
				this.readerClaimedStyle = true;
			}
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
		// The one input that does not go through `rebuildSpecFromCurrentText`, so it clears the
		// pageless request's diagnostics itself. Same reason as every Page Control: a report about a
		// prompt built from the previous dedication is not a report about this one.
		this.clearPagelessRequestDiagnostics();
		this.dedication = value;
		this.spec = { ...this.spec, dedication: this.currentDedication() };
		void this.validateSpec();
		this.scheduleDraftSave();
	};

	handleModeSelect = (modeId: string): void => {
		const modeChanged = modeId !== this.activeModeId;
		this.activeModeId = modeId;
		this.textFailure = null;
		if (modeChanged) {
			this.clearVerdict();
			this.resetGeneratedPage();
			this.restoredPageLayout = false;
			// The switch just deleted the verdict the spent rewrites were spent on. Carrying the
			// spend across to a mode the reader has not asked anything yet is what stranded them.
			this.startRewriteRound();
			// And anything still in flight for the old mode belongs to that mode, not this one.
			this.verdictToken += 1;
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
		this.pageFailure = null;
		// Not the panel's handler: the wig is the try-on studio's control, and the panel's summary
		// deliberately does not name it. A rebuild that fails here belongs on the try-on studio's own
		// error line, not filed under settings the reader did not touch.
		//
		// Still swallowed rather than rethrown — this is a DOM event handler, and rethrowing produced
		// an unhandled rejection that told nobody anything.
		try {
			await this.rebuildSpecFromCurrentText();
			// Picking a wig is the reader naming a style, on the same terms as a theme click: it
			// reaches the hint the same way, and re-picking the one already selected changes no value
			// a comparison could see. Recorded only on a rebuild that succeeded, for the reason given
			// where the theme sets it.
			this.readerClaimedStyle = true;
		} catch (error) {
			// A LOCAL spec rebuild, not a provider call: nothing was sent, so this is the app
			// declining rather than Meechie refusing. `UNCHECKED_SETTINGS_MESSAGE` covers the case
			// where the thrown value carries nothing usable.
			this.pageFailure = this.classifyPageFailure({
				rejected:
					error instanceof Error && error.message
						? error.message
						: UNCHECKED_SETTINGS_MESSAGE
			});
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

	/**
	 * How this studio reads whether the device has a connection. Assignable so a test can state it.
	 */
	readConnection: () => boolean | null = readIsOnline;

	/**
	 * Classify one failed page generation on this studio.
	 *
	 * The IMAGE bucket's reset instant, because that is what the page button spends — the text
	 * helper above uses the other one. Two helpers rather than one shared with a `bucket` argument,
	 * so a call site cannot pick the wrong bucket at all.
	 */
	/**
	 * Classify, and stamp the result with when it happened relative to this studio's other failures.
	 *
	 * Every classification on this studio goes through here, so the three helpers below cannot each
	 * keep their own idea of what "most recent" means. A classification the caller then discards is
	 * simply never read, because `traceFailureDetail` only looks at failures a field still holds.
	 */
	private recordFailure(
		input: Parameters<typeof classifyGenerationFailure>[0]
	): StampedFailure {
		this.failureStamp += 1;
		return {
			...classifyGenerationFailure(input),
			[FAILURE_STAMP]: this.failureStamp
		};
	}

	private classifyPageFailure(
		input: FailureCallSiteInput
	): GenerationFailure {
		return this.recordFailure({
			...input,
			subject: PAGE_SUBJECT,
			// This studio clears the page before generating a replacement, so there is never one
			// underneath a failure for the sentence to reassure the reader about.
			pageKept: false,
			quotaResetAtMs: this.quota.image?.resetAtMs ?? null,
			isOnline: this.readConnection()
		});
	}

	/**
	 * Classify one failed text action, with the context only this studio holds.
	 *
	 * The TEXT bucket's reset instant: `/api/meechie-studio-text` spends that one, and naming the
	 * image window's instant here would be the bucket mix-up `AiQuotaLedger` exists to prevent.
	 */
	/**
	 * Classify one failed wig try-on.
	 *
	 * The IMAGE bucket's reset instant, because `/api/wig-try-on` charges `WIG_TRY_ON_QUOTA_COST`
	 * against that bucket — the same eight units a minute that fund coloring pages, which is why
	 * `tryOnQuotaMessage` a few lines above reads from it too. Naming the text window's instant here
	 * would be the bucket mix-up `AiQuotaLedger` exists to prevent, and it would be visible: the
	 * quota line and the failure's "ready again at" sit in the same column of the same panel.
	 */
	private classifyTryOnFailure(
		input: FailureCallSiteInput
	): GenerationFailure {
		return this.recordFailure({
			...input,
			subject: TRY_ON_SUBJECT,
			// A try-on clears the coloring page before it starts (`resetTryOnPageState`), so there is
			// never one underneath the failure for the sentence to reassure the reader about. The
			// portraits in the compare strip do survive, but `pageKept` is about the page on paper,
			// and widening it to mean "something else on screen survived" would make the sentence it
			// appends untrue on every other surface that reads it.
			pageKept: false,
			quotaResetAtMs: this.quota.image?.resetAtMs ?? null,
			isOnline: this.readConnection()
		});
	}

	private classifyTextFailure(
		input: FailureCallSiteInput
	): GenerationFailure {
		return this.recordFailure({
			...input,
			subject: VERDICT_SUBJECT,
			// A text failure never touches the page on the paper: it is about the words, and the
			// picture below is untouched either way.
			pageKept: false,
			quotaResetAtMs: this.quota.text?.resetAtMs ?? null,
			isOnline: this.readConnection()
		});
	}

	/**
	 * Run the same text action again.
	 *
	 * Re-runs the action that was attempted, not whichever one is selected now — the studio's
	 * controls stay live while the failure is on screen.
	 */
	retryTextAction = async (): Promise<void> => {
		const actionId = this.lastTextActionId;
		if (actionId === null || this.isTextWorking) return;
		await this.runTextAction(actionId);
	};

	runTextAction = async (actionId: StudioTextActionId): Promise<void> => {
		let action: ReturnType<typeof getStudioTextAction>;
		try {
			action = getStudioTextAction(actionId);
		} catch {
			this.textFailure = this.classifyTextFailure({
				rejected: 'This action is not available. Try Generate Verdict instead.'
			});
			return;
		}
		if (
			this.aiQuotaExhausted ||
			!canRunStudioAction(actionId, {
				remainingBudget: this.revisionBudget,
				isRunning: this.isTextWorking
			})
		) {
			return;
		}
		this.textFailure = null;
		this.copyStatus = '';
		this.vaultStatus = '';
		const trimmedEvidence = this.evidence.trim();
		const safeEvidence =
			trimmedEvidence.length > 0 || this.activeMode.toolId === 'random_meechie'
				? trimmedEvidence || 'Random Meechie line request.'
				: '';
		if (!safeEvidence) {
			this.textFailure = this.classifyTextFailure({
				rejected: 'Meechie needs a few facts before she can call it.'
			});
			return;
		}

		this.isTextWorking = true;
		// Recorded before the request, so a retry re-runs this action rather than whichever one the
		// reader has since selected.
		this.lastTextActionId = actionId;
		// The instant the quota headers describe, captured before the request rather than after it.
		// The server charges the bucket and computes `RateLimit-Reset` *before* it calls the
		// provider, so by the time the response lands that duration has already been running for
		// as long as the provider took — up to 230 seconds on this route, against a 60-second
		// window. Anchoring at response receipt would put the reset minutes into the future for a
		// bucket that had already refilled.
		const requestStartedAtMs = this.clock.now();
		// Captured before the await, compared after it. See `verdictToken`.
		const roundToken = this.verdictToken;
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
				{
					timeoutMs: POST_JSON_TIMEOUTS_MS.studioText,
					// Read on every response the route produces, refusals included, because a refusal
					// is exactly when the reader most needs to be told what the limit is and when it
					// lifts. A response without usable quota headers leaves the last reading alone
					// rather than blanking the meter on one odd reply.
					onResponseHeaders: (headers) =>
						this.quota.record(headers, requestStartedAtMs, 'text')
				}
			);
			// The reader has moved to another round while this was in flight. The reply describes a
			// verdict nobody is looking at any more, so none of it lands: not the words, not the
			// charge, not the page reset. The quota reading above is deliberately *not* guarded —
			// it describes this caller's bucket, which the server charged whatever the reader did
			// next, so it stays true and useful.
			if (roundToken !== this.verdictToken) return;
			const parsed = MeechieStudioTextResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.textFailure = this.classifyTextFailure({ offContract: true });
				return;
			}
			if (!parsed.data.ok) {
				this.textFailure = this.classifyTextFailure({
					apiError: parsed.data.error
				});
				return;
			}
			// A live response: this `qualityState` is Meechie's own, whatever it says.
			this.acceptVerdict(parsed.data.value);
			// Order matters: a round-starting action refills the allowance for the verdict it just
			// produced, and a rewrite spends one of the allowance the verdict on screen came with.
			// Both are applied only on an accepted verdict, so a failure, a timeout or an
			// unreadable reply still costs the reader nothing.
			if (studioActionStartsRound(actionId)) {
				this.startRewriteRound();
			} else {
				this.revisionBudget = consumeStudioActionBudget(this.revisionBudget, actionId);
			}
			this.resetGeneratedPage();
			// Only now, with a replacement verdict accepted, does a reopened page's layout stop
			// applying. Clearing it when the action *started* would convert the restored quote page
			// into a numbered list whenever the action then failed, timed out, or was rejected —
			// while its text was still the text on screen.
			this.restoredPageLayout = false;
			await this.applyTextToSpec(parsed.data.value);
		} catch (error) {
			// Same rule for a failure: an error about the round the reader walked away from would
			// otherwise appear under the mode they walked to.
			if (roundToken !== this.verdictToken) return;
			this.textFailure = this.classifyTextFailure({ thrown: error });
		} finally {
			// Cleared unconditionally: only one text request can be in flight at a time, so this one
			// is the one that owns the flag whether or not its result is still wanted. Leaving it set
			// on a stale round would wedge every AI button on the new one.
			this.isTextWorking = false;
		}
	};

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
		await this.runPackaging(
			STUDIO_EXPORT_VARIANTS,
			images,
			fileBaseName,
			pageSize,
			pageToken,
			(attempt) =>
				this.installPackageAttempts([...this.packageAttempts, attempt], attempt)
		);
	}

	/**
	 * Package the given variants, in order, and return the attempts — or `null` when the page was
	 * replaced part-way and the late files belong to a page nobody is looking at.
	 *
	 * Returns rather than assigns, because a generation installs a whole new row and a rebuild merges
	 * a subset back into the one on screen. Those are different installs of the same work.
	 */
	private async runPackaging(
		variants: readonly OutputVariant[],
		images: GeneratedImage[],
		fileBaseName: string,
		pageSize: ColoringPageSpec['pageSize'],
		pageToken: number,
		install: (attempt: PageExportAttempt) => void
	): Promise<void> {
		for (const variant of variants) {
			const attempt = await packagePageVariant(variant, images, fileBaseName, pageSize);
			// Checked between variants, not only at the end: the square variant rasterises a fresh
			// canvas, and starting that for a page the reader has already replaced spends time and
			// memory on a result that is guaranteed to be thrown away.
			if (pageToken !== this.pageLoadToken) return;
			install(attempt);
		}
	}

	/**
	 * Put packaging attempts on screen, and stamp them if any of them failed.
	 *
	 * The stamp is what lets `traceFailureDetail` order a packaging failure against the three
	 * classified ones. Without it packaging was a bare fallback, so a `textFailure` left live by an
	 * earlier action — neither `handleGeneratePage` nor `resetGeneratedPage` clears one — masked the
	 * packaging diagnostic for good, and System Trace showed the older problem beside the newer
	 * notice.
	 */
	private installPackageAttempts(
		attempts: PageExportAttempt[],
		installed: PageExportAttempt
	): void {
		this.packageAttempts = attempts;
		// Nothing failing means nothing to order. Resetting rather than leaving the old stamp keeps
		// the field from outliving the failure it dated.
		if (pageExportFailureDetail(attempts) === null) {
			this.packagingFailureStamp = 0;
			return;
		}
		// Stamped for the attempt just installed, never for whatever the merged set happens to
		// contain. Reading the whole set re-dated an OLD failure every time a rebuild installed a
		// SUCCESSFUL variant beside it — so a text failure that happened in between was pushed back
		// behind a packaging diagnostic that had not changed since before it.
		if (installed.failure === null) return;
		this.failureStamp += 1;
		this.packagingFailureStamp = this.failureStamp;
	}

	/**
	 * Build the downloads again for the page already on screen.
	 *
	 * The remedy this studio never had. Packaging is the only failing step in the app that spends
	 * nothing — the picture is already in memory and already paid for, and the whole step is a canvas
	 * and a PDF on this device — and until now the only control anywhere near a failed download was
	 * "Make the page", which buys another generation and re-rolls the picture the reader liked.
	 *
	 * Asks for **only the variants that failed**, and merges them back. Re-running one that succeeded
	 * could take away a download the reader already has: the commonest failure here is memory, and
	 * its commonest shape is "the PDF built, the 1080px share canvas did not" — so re-running the PDF
	 * under that same pressure is how the one control offered against a partial failure would make it
	 * total.
	 *
	 * Re-uses `pageFileBaseName` rather than stamping a new one, so rebuilt files still match an
	 * original image the reader may already have grabbed. `pageSize` comes off the attempt being
	 * rebuilt and never from the live Page Controls, which stay enabled: re-reading them would
	 * package the second attempt for different paper than the picture and the saved record.
	 */
	rebuildPageExports = async (): Promise<void> => {
		if (this.isGenerating || this.isRebuildingDownloads) return;
		const previous = this.packageAttempts;
		const variants = rebuildableExportVariants(previous);
		const pageSize = previous[0]?.pageSize;
		if (variants.length === 0) return;
		if (this.images.length === 0 || !pageSize || this.pageFileBaseName === '') return;
		const images = $state.snapshot(this.images);
		const token = this.pageLoadToken;
		this.isRebuildingDownloads = true;
		try {
			// Merged one at a time, against whatever the row currently holds rather than against the
			// `previous` snapshot, so a variant that lands while a later one hangs is usable now.
			await this.runPackaging(
				variants,
				images,
				this.pageFileBaseName,
				pageSize,
				token,
				(attempt) =>
					this.installPackageAttempts(
						mergeRebuiltAttempts(this.packageAttempts, [attempt]),
						attempt
					)
			);
		} finally {
			// Only if this call still owns the paper — see `PageArtifactState.rebuildDownloads`.
			if (token === this.pageLoadToken) this.isRebuildingDownloads = false;
		}
	};

	handleGeneratePage = async (): Promise<void> => {
		if (!this.textOutput) {
			this.pageFailure = this.classifyPageFailure({
				rejected: 'Generate Meechie words before creating the page.'
			});
			return;
		}
		// The image bucket, not the text one the buttons above this are gated on. The line under the
		// button already says the desk is full; letting the click through anyway would contradict it.
		if (this.pageQuotaExhausted) return;
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
		this.lastPageAttempt = 'page';
		try {
			await this.applyTextToSpec(this.textOutput);
			if (pageToken !== this.pageLoadToken) return;
			if (this.validationIssues.length > 0) {
				this.pageFailure = this.classifyPageFailure({
					rejected: 'Fix the page settings before generating.'
				});
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
			// Anchored at send: this route can run for minutes against a 60-second window.
			const requestedAtMs = this.clock.now();
			const payload = await postJson(
				'/api/generate',
				{
					spec: requestedSpec,
					styleHint: buildStyleHint(requestedStyle)
				},
				{
					timeoutMs: POST_JSON_TIMEOUTS_MS.generate,
					// The image bucket, which is what this button spends. The studio has always had
					// a quota line, and until now it reported the text bucket only — a number from a
					// different bucket, on a different window, sitting above this button.
					onResponseHeaders: (headers) =>
						this.quota.record(headers, requestedAtMs, 'image')
				}
			);
			if (pageToken !== this.pageLoadToken) return;
			const parsed = GenerateResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.pageFailure = this.classifyPageFailure({ offContract: true });
				return;
			}
			if (!parsed.data.ok) {
				this.pageFailure = this.classifyPageFailure({ apiError: parsed.data.error });
				return;
			}
			this.assembledPrompt = parsed.data.value.prompt;
			this.images = parsed.data.value.images;
			this.revisedPrompt = parsed.data.value.revisedPrompt || '';
			this.violations = parsed.data.value.violations;
			this.recommendedFixes = parsed.data.value.recommendedFixes;
			// Set with the trace and above the no-picture guard below, for the reason that guard's
			// own comment gives: a response that carries findings but no image has still been
			// checked, and its findings are the most useful thing on screen.
			this.driftReported = true;
			this.promptWasSent = true;
			this.driftCheckFailure = parsed.data.value.driftCheckFailure;

			// A generate response can be schema-valid and still carry no picture: `images` is
			// `z.array(...)` with no minimum. That used to reach the packaging seam and come back as
			// "No images provided for packaging." — a message about a step that should never have
			// been entered, in a field the reader has no way to connect to what happened. The trace
			// above is assigned first so the System Trace still shows what was asked for.
			if (this.images.length === 0) {
				// `PROVIDER_EMPTY_IMAGE` is the app's own reading of a schema-valid response with an
				// empty `images` array — `GenerateResultSchema` has no minimum — rather than a code
				// the route sent. It is the right code for it: the same one the provider seam emits
				// for the same condition, and it keeps one sentence for one thing.
				this.pageFailure = this.classifyPageFailure({
					apiError: {
						code: 'PROVIDER_EMPTY_IMAGE',
						message: 'Meechie sent the words back without a picture.'
					}
				});
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

			const creationId = newCreationId();
			await this.attachPageExports(
				`meechie-coloring-page-${creationId}`,
				pageToken,
				requestedSpec.pageSize
			);
		} catch (error) {
			this.pageFailure = this.classifyPageFailure({ thrown: error });
		} finally {
			this.isGenerating = false;
		}
	};

	/**
	 * Make the page again, the same way it was made last time.
	 *
	 * Dispatches on which generator was attempted rather than on what is currently selected: a
	 * try-on page that failed must not be retried as a quote page.
	 */
	retryPage = async (): Promise<void> => {
		if (this.isGenerating) return;
		if (this.lastPageAttempt === 'tryOn') {
			await this.handleGenerateTryOnPage();
			return;
		}
		if (this.lastPageAttempt === 'page') await this.handleGeneratePage();
	};

	handleGenerateTryOnPage = async (): Promise<void> => {
		// See `canGenerateTryOnPage`. Guarded here too, not only on the button: the race is between
		// two state transitions, so the state is where it has to be refused.
		if (this.isTryingOn) {
			this.pageFailure = this.classifyPageFailure({
				rejected: 'Wait for the new look to finish before making the page.'
			});
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
			this.pageFailure = this.classifyPageFailure({
				rejected: 'Create a try-on portrait first.'
			});
			return;
		}
		this.resetGeneratedPage();
		// Taken after the reset, which advances it. Selecting another wig resets the page again, so
		// a moved token means the reader is no longer looking at the page they asked for.
		const pageToken = this.pageLoadToken;
		this.isGenerating = true;
		this.lastPageAttempt = 'tryOn';
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
				this.pageFailure = this.classifyPageFailure({
					rejected:
						'Try-on portrait format is not supported for coloring-page export.'
				});
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
				this.pageFailure = this.classifyPageFailure({
					rejected: 'Fix the page settings before generating.'
				});
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
			const creationId = newCreationId();
			await this.attachPageExports(
				`meechie-try-on-coloring-page-${creationId}`,
				pageToken,
				requestedSpec.pageSize
			);
		} catch {
			// The try-on page is assembled locally from a portrait the reader already has; no
			// provider is called on this path. So a throw here is this app failing, not a request
			// that did not arrive, and the classifier must not word it as a connection problem.
			this.pageFailure = this.classifyPageFailure({
				rejected:
					'The try-on page could not be assembled. Try creating it again.'
			});
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
			// A defensive guard, not a path the reader can reach today: `canTryOn` already requires
			// both a wig and a selfie, so the button that calls this is disabled in exactly the case
			// this catches, and with no wig the panel holding it is not rendered at all. It is
			// classified rather than left as a bare string so that it stays correct if a caller ever
			// arrives that is not that button.
			//
			// `rejected`, not `apiError`: nothing was sent, so this is the app declining to spend the
			// reader's quota rather than Meechie refusing the look. Routed through the code map it
			// would read "Meechie would not make that try-on: Select a wig and upload your selfie
			// first", which blames her for two controls the reader can simply use. It still lands as
			// `request_rejected`, so no retry control is offered against an unchanged request.
			this.tryOnFailure = this.classifyTryOnFailure({
				rejected: 'Select a wig and upload your selfie first.'
			});
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
		const requestedAtMs = this.clock.now();
		try {
			const payload = await postJson(
				'/api/wig-try-on',
				{
					selfieBase64: this.selfieBase64,
					selfieMimeType: this.selfieMimeType,
					wigId: requestedWig.id
				},
				{
					timeoutMs: POST_JSON_TIMEOUTS_MS.wigTryOn,
					// A try-on spends the IMAGE bucket, the same eight units a minute that fund
					// coloring pages. Nothing on this surface said so, and a reader who tried four
					// wigs then pressed "make the page" had spent half their page allowance on
					// hair without ever being shown a number.
					onResponseHeaders: (headers) =>
						this.quota.record(headers, requestedAtMs, 'image')
				}
			);
			const parsed = WigTryOnResultSchema.safeParse(payload);
			if (!parsed.success) {
				this.setTryOnFailure(
					this.classifyTryOnFailure({ offContract: true }),
					requestedWig.id,
					requestedSelfieToken
				);
				return;
			}
			if (!parsed.data.ok) {
				// The route's own message, which reached the reader through
				// `toPublicProviderError`'s allowlist and was written to be read. The code beside it
				// is what turns a 429 into a named instant and a config error into "not something you
				// can fix from here" — every `WIG_TRY_ON_*` code this route emits is already mapped in
				// `CAUSE_BY_CODE`, and until now not one of them could be reached.
				this.setTryOnFailure(
					this.classifyTryOnFailure({ apiError: parsed.data.error }),
					requestedWig.id,
					requestedSelfieToken
				);
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
			// The thrown value goes in whole and is classified by its shape. Its text reaches
			// `failure.detail` and System Trace, and never the sentence — this line is where
			// `Failed to fetch` used to become the app's account of itself.
			this.setTryOnFailure(
				this.classifyTryOnFailure({ thrown: error }),
				requestedWig.id,
				requestedSelfieToken
			);
		} finally {
			this.isTryingOn = false;
		}
	};

	/**
	 * Try the same look again.
	 *
	 * It re-runs `handleWigTryOn`, which reads the live wig and the live selfie — and that is the
	 * *correct* request rather than a convenient one, because `setTryOnFailure` below only ever puts
	 * a failure on screen while its own wig is still selected and its own selfie still uploaded. So a
	 * visible try-on failure is, by construction, a failure of exactly what those two controls hold
	 * now. The other surfaces pin the attempted request in a `lastAttempted…` field precisely because
	 * they have no such guard; adding one here would be a second source of truth for "which wig is on
	 * screen", which is the thing `selectedWigId` is derived rather than stored to avoid.
	 */
	retryWigTryOn = async (): Promise<void> => {
		if (this.isTryingOn) return;
		await this.handleWigTryOn();
	};

	/**
	 * Shows a try-on failure only while it is still the reader's failure to read: the wig it
	 * happened to is still on screen, and the selfie it was for is still the uploaded one. A
	 * failure for a wig they have moved off, or for a photo they have replaced, is neither.
	 */
	private setTryOnFailure(
		failure: GenerationFailure,
		wigId: string,
		selfieToken: number
	): void {
		if (this.selectedWigId !== wigId) return;
		if (selfieToken !== this.selfieToken) return;
		this.tryOnFailure = failure;
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
		this.vaultSaveFailure = null;
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
		const creationId = newCreationId();
		const storedImages = this.images.map((image) => ({
			b64: image.encoding === 'base64' ? image.data : this.encodeBase64(image.data)
		}));
		try {
			const result = await creationStoreAdapter.saveCreation({
				record: {
					id: creationId,
					// Through `ClockSeam`, not `new Date()`: `AGENTS.md` classifies clock/time as a
					// seam, and this studio already holds one for the "Saved today" labels. It was
					// the last direct wall-clock read on any save path in the app.
					createdAtISO: new Date(this.clock.now()).toISOString(),
					intent,
					assembledPrompt,
					// Only text that actually describes this page is saved as its own.
					studioText: this.describingStudioText(),
					revisedPrompt: this.revisedPrompt || undefined,
					images: storedImages.length > 0 ? storedImages : undefined,
					violations: $state.snapshot(this.violations),
					// `fixesApplied` is deliberately omitted, not filled from `recommendedFixes`.
					// This studio never applies a recommendation and never regenerates with one, so
					// writing them into a field named "applied" recorded a correction that did not
					// happen — and a later reader could not tell a drifted page from a corrected
					// one. `violations` above still carries the full drift evidence, which is the
					// part that is actually true. `PageArtifactState` reached this conclusion for
					// the other thirteen surfaces and named this call site as the defect it could
					// not fix from there.
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
			// The refusal's own words only where this app wrote them for a reader — which is exactly
			// what `classifyStorageFailure` returns verbatim for the capacity refusals, so
			// `vaultLinkFor` still matches them character-for-character and still offers "Make room
			// in the vault". Everything else becomes a sentence, and the seam's message goes to
			// `vaultSaveFailure.detail` where System Trace can have it.
			if (result.ok) {
				this.vaultSaveFailure = null;
				this.vaultStatus = VAULT_SAVED_CONFIRMATION;
			} else {
				const failure = classifyStorageFailure('save', result.error);
				this.vaultSaveFailure = failure;
				this.vaultStatus = failure.message;
			}
			await this.refreshCreations();
		} catch (error) {
			// This branch used to put a caught exception's own message on screen. It is the precise
			// thing `generation-failure.ts` forbids for AI calls, and storage was still doing it.
			this.vaultSaveFailure = classifyStorageFailure('save', error);
			this.vaultStatus = this.vaultSaveFailure.message;
		} finally {
			this.isSaving = false;
		}
	};

	/**
	 * Reopen the saved page with this id, for a reader arriving from `/vault`.
	 *
	 * Called after `init()`, so `creations` is the list this device actually holds. A record that
	 * is not in it says so rather than doing nothing: the id in the link is real to whoever sent it
	 * and the commonest reasons it misses here — the page was deleted, or the link came from
	 * somebody else's device — are both invisible without a sentence. The vault is per-device and
	 * never uploaded, so a link that works for its author will not work for anyone else, and that
	 * is worth saying out loud rather than rendering as an empty studio.
	 */
	openSavedPage = async (id: string): Promise<void> => {
		const record = this.creations.find((creation) => creation.id === id);
		if (!record) {
			this.vaultStatus =
				'That saved page is not on this device. Saved pages live in the browser they were ' +
				'made in, so a link to one only opens for whoever saved it.';
			return;
		}
		await this.loadCreation(record);
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
		// The reopened page's own lettering and blank space become the reader's current choice, for
		// the same reason page size and border above do: they are stored spec fields, they came back
		// with the record, and the controls that show them have to show the page that is on screen.
		// Left at `null` instead, the panel would report the studio's defaults over a page built at
		// `large` and 35 — the false provenance the panel's second invariant exists to stop.
		this.pageLook = {
			textSize: creation.intent.textSize,
			whitespaceScale: creation.intent.whitespaceScale
		};
		this.restoreVerdict(restoredText, creation.studioText);
		// A reopened page is a verdict the reader has not reworked in this session, and its rewrite
		// buttons light up the moment `textOutput` is set above. Handing it whatever was left of
		// some earlier page's allowance would let a saved page arrive with none.
		this.startRewriteRound();
		// A verdict still in flight was asked about the page this one just replaced.
		this.verdictToken += 1;
		// Reopening a saved page used to hand back the words and drop the picture, so the only
		// way to see your own page again was to pay for another generation. The record already
		// carries the image bytes and the trace, so give all of it back.
		this.images = restoredImages;
		this.assembledPrompt = creation.assembledPrompt;
		this.revisedPrompt = creation.revisedPrompt ?? '';
		this.violations = creation.violations ?? [];
		// `!== undefined`, not `.length > 0`. A record saved before the vault stored findings has no
		// `violations` at all, and `?? []` above turns that absence into an empty array — which the
		// report would otherwise read as "checked, nothing wrong". A record that never wrote down its
		// findings is a page whose check result is unknown, and unknown is not clean.
		// `.length > 0`, not `!== undefined`. A record stores `violations` and nothing else about the
		// check, so a stored *empty* array is ambiguous in exactly the way this whole change exists to
		// remove: it is written both by a page that passed and by a page whose check failed, because
		// a failed check also produces no violations. Treating it as "checked" resurrected the false
		// clean on the vault path — the same defect, one round trip later.
		//
		// So: stored findings mean the check reported, and are shown. Anything else is a result that
		// is not on file, and says so. The genuine clean case is undersold rather than the failed one
		// oversold; persisting the distinction needs a `CreationRecordSchema` field and the full
		// Seam-Driven Development workflow, and is recorded as deferred.
		const storedFindings = creation.violations ?? [];
		this.driftReported = storedFindings.length > 0;
		this.checkResultUnrecorded = storedFindings.length === 0;
		// Stored findings are proof the record went through `/api/generate`, which is the only path
		// that produces them — so its `assembledPrompt` is a prompt that really was sent, and System
		// Trace can show it as one. Without this, a reopened flagged page listed prompt-derived
		// findings directly beside "No prompt sent yet", and its stored rewrite appeared underneath
		// that denial.
		//
		// A record with no stored findings stays `false`: it is either a try-on portrait, whose
		// `assembledPrompt` is a description that was never sent, or a generated page whose result
		// was not persisted. The record carries no marker telling them apart, so this understates
		// rather than guesses — the same posture as `checkResultUnrecorded` above, and the same
		// `CreationRecordSchema` field would settle both.
		this.promptWasSent = storedFindings.length > 0;
		// A saved record carries no failure reason; `resetGeneratedPage` already cleared any.
		this.driftCheckFailure = undefined;
		this.vaultStatus = `Reopened "${creation.intent.title}".`;
		await this.validateSpec();
		// The same builder the two generation paths use, so a reopened page gets the same downloads a
		// freshly generated one does — and reports what it could not build instead of leaving a dead
		// button with no reason, which is what its own near-copy of this used to do.
		await this.attachPageExports(
			`meechie-coloring-page-${newCreationId()}`,
			this.pageLoadToken,
			creation.intent.pageSize
		);
		this.scheduleDraftSave();
	};

	setVaultQuery = (value: string): void => {
		this.vault.setQuery(value);
	};

	toggleVaultShowAll = (): void => {
		this.vaultShowAll = !this.vaultShowAll;
		// Collapsing can hide the armed row exactly as a search can, and an armed delete left
		// off-screen would still be primed when the list is expanded again.
		this.vault.disarmDelete();
	};

	requestDeleteCreation = (id: string): void => {
		this.vault.requestDelete(id);
	};

	cancelDeleteCreation = (): void => {
		this.vault.cancelDelete();
	};

	deleteCreation = async (id: string): Promise<void> => {
		await this.vault.remove(id);
	};

	undoDelete = async (): Promise<void> => {
		await this.vault.undoDelete();
	};

	dismissUndoDelete = (): void => {
		this.vault.dismissUndoDelete();
	};

	toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		await this.vault.toggleFavorite(creation);
	};

	// --- Lifecycle ---

	async init(): Promise<void> {
		this.isBrowser = true;
		// Re-read rather than trusting the field initializer: a test or an alternate host may have
		// replaced `origin` after construction, and the value captured then would be the default
		// adapter's. The clock and visibility seams are consulted here for the same reason.
		this.appOrigin = this.origin.getOrigin();
		// The same re-read, for the same reason, and it was missing. `nowMs`'s field initializer
		// ran against whatever `clock` was at construction — the default adapter — so an injected
		// clock did not reach it until the first day boundary fired or the vault was read. Every
		// existing test happened to survive that because they all advance the clock explicitly
		// before asserting on it; the spotlight does not have that luxury, because what it shows is
		// a function of the instant at the moment the page renders and nothing has to move for it
		// to be wrong.
		this.nowMs = this.clock.now();
		this.vault.startSavedLabelRefresh();
		const [sessionResult, draft] = await Promise.all([
			sessionAdapter.getSession(),
			creationStoreAdapter.getDraft({})
		]);
		if (sessionResult.ok) {
			// The studio reads the session itself rather than calling `vault.init()`, because it
			// needs the same id for `AuthContextSeam` and must not pay for two session reads. The
			// owner is still built in one place, so the set this files under and the set the vault
			// lists cannot come apart.
			this.vault.adoptOwner(sessionResult.value.sessionId);
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
			// The same question `loadCreation` asks of a record, asked of a draft, because the same
			// thing goes wrong when it is not asked. `DraftRecordSchema` accepts a draft with no
			// `styleSelection` — every draft written before the field existed is one — and leaving
			// the flag false made the studio treat whatever the controls happened to say as that
			// draft's own style. The next autosave then wrote those values down beside the restored
			// intent, which they did not author, and the refresh after that applied them: invented
			// provenance, arrived at in two steps from a draft that recorded none.
			//
			// Before `applyRestoredStyleSelection`, which is the same order the seeding below needs
			// and reads correctly either way: this is a fact about the record being restored, not
			// about the controls it may be about to move.
			this.restoredStyleUnknown = draft.value.styleSelection === undefined;
			// Before the seeding below, for the reason given in `loadCreation`.
			this.applyRestoredStyleSelection(draft.value.styleSelection);
			this.lastDerivesDense = derivesDenseDecorations(this.currentStyleHint());
			this.evidence = draft.value.chatMessage || '';
			this.dedication = draft.value.intent.dedication ?? '';
			this.pageSize = draft.value.intent.pageSize;
			this.border = draft.value.intent.border;
			// As in `loadCreation`: stored spec fields the controls have to show.
			this.pageLook = {
				textSize: draft.value.intent.textSize,
				whitespaceScale: draft.value.intent.whitespaceScale
			};
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
				this.restoreVerdict(
					buildStudioTextFromDraftRecord(draft.value),
					draft.value.studioText
				);
			}
		}
		await this.validateSpec();
		await this.refreshCreations();
	}

	destroy(): void {
		if (this.draftTimer) {
			globalThis.clearTimeout(this.draftTimer);
		}
		this.quota.dispose();
		// The day-boundary timer and the visibility subscription belong to the collection now, and
		// so does tearing them down. Forgetting this call would leave a timer re-arming itself
		// against a destroyed studio for as long as the tab lives.
		this.vault.destroy();
	}
}
