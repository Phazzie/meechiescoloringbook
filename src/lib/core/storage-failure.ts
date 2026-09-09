/*
 * Purpose: The one place that decides what a reader is told when the app's own memory fails — the
 *          Quote Vault and the studio draft — and whether trying again is worth offering.
 * Why: `generation-failure.ts` abolished the raw error string for AI calls and left storage doing
 *      the exact thing it was written to stop. Nine call sites wrote a seam message, or the message
 *      of a CAUGHT EXCEPTION, straight onto the screen: `vault-collection.svelte.ts` on a failed
 *      read, delete, restore and pin; `page-artifact-state.svelte.ts` on a failed vault save and in
 *      its catch; `studio-state.svelte.ts` on a failed draft save and in its catch. So a reader
 *      whose browser blocks site data was shown `Creation store requires a browser environment.`,
 *      and a reader whose store had been damaged was shown `Stored creations are not an array.` —
 *      both addressed to whoever wrote the adapter, both naming no remedy, and none of them
 *      offering a way to try again. That last part is the sharpest loss here: unlike every AI
 *      failure in this app, a storage retry costs nothing. No quota, no provider, no network. The
 *      surface with the cheapest possible retry was the only one with no retry at all.
 * Info flow: seam `SeamError` / caught exception + which operation was being attempted
 *            -> classifyStorageFailure -> StorageFailure -> StorageFailureNotice.svelte.
 * Invariants:
 *   - Pure. No clock, no `navigator`, no I/O, no storage access of its own.
 *   - A message that reached us from an EXCEPTION is never shown to a reader. It becomes `detail`.
 *   - A message THIS APP WROTE FOR A READER is shown verbatim. Those are the three capacity
 *     refusals in `vault-capacity.ts`, and verbatim is not a preference: `vaultLinkFor` matches them
 *     character-for-character to decide whether the status line carries "Make room in the vault", so
 *     rewording one silently removes the link the reader needs most. Same rule, and the same reason,
 *     as the server-message allowlist in `public-provider-error.ts`.
 *   - A retry is offered only where retrying could plausibly succeed — and "plausibly" is the bar,
 *     not "certainly". A store that is out of room is still out of room a second later, and a
 *     record the store refuses for its own shape is refused identically: those get a remedy
 *     sentence instead of a button that does nothing. A blocked browser gets a button, because the
 *     sentence asks the reader to change a setting and pressing it is how they find out it took.
 *   - **A remedy that destroys the reader's work is never given on a guess.** `readJson` reports a
 *     denied `getItem` and an unparseable value under one code, so `unreadable` cannot know which
 *     it is; its sentence therefore names both, harmless check first, and makes clearing stored
 *     data explicitly conditional on the harmless one being ruled out. The first draft told every
 *     such reader to clear their site data, which for the blocked-browser half of them would have
 *     deleted saved pages that were never damaged.
 *   - A remedy is never named that the surface cannot perform. The draft failure does not say
 *     "download it": there is no draft export anywhere in the app.
 */

import {
	VAULT_DEVICE_FULL_REFUSAL,
	VAULT_ID_COLLISION_REFUSAL,
	VAULT_RECORD_CAP_REFUSAL
} from './vault-capacity';

/**
 * Which of the app's memory operations was being attempted.
 *
 * The cause alone does not decide the sentence. "The page on screen could not be saved" and "your
 * saved pages could not be read" are the same `unavailable` cause with opposite consequences: one
 * threatens work the reader can still see and act on, the other threatens work they cannot. A
 * classifier that knew only the cause would have to write one sentence vague enough to cover both.
 */
export type StorageOperation =
	/** Listing the saved pages. */
	| 'read'
	/** Writing a finished page into the vault. */
	| 'save'
	/** Removing a saved page. */
	| 'delete'
	/** Putting a deleted page back. */
	| 'restore'
	/** Pinning a saved page. */
	| 'pin'
	/**
	 * Unpinning a saved page.
	 *
	 * Its own operation rather than sharing `pin`, because the two go through one `toggleFavorite`
	 * and a shared sentence gets the direction wrong half the time: a reader who pressed Unpin was
	 * told "This page could not be pinned" and offered "Try pinning again", under a button that
	 * would in fact unpin it.
	 */
	| 'unpin'
	/** Autosaving the studio's work in progress. */
	| 'draft';

/**
 * Why a storage operation did not do what was asked.
 *
 * Coarser than the adapter's codes on purpose, exactly as `GenerationFailureCause` is coarser than
 * the route error codes: these are the distinctions that change what a reader should *do*.
 */
export type StorageFailureCause =
	/** This browser will not give the app any storage at all. Usually site data is blocked. */
	| 'unavailable'
	/** Something is stored and nothing can read it. The same bytes will not parse next time either. */
	| 'unreadable'
	/**
	 * The thing being written was refused for its own shape, before any storage was touched.
	 *
	 * Told apart from `unreadable` because nothing stored is damaged and the reader's saved pages are
	 * fine — this is the app handing the store something the store will not take, which is a defect
	 * in this app and not a condition of the device. Collapsing the two would tell a reader whose
	 * vault is perfectly healthy to clear their site data.
	 */
	| 'rejected'
	/** The device is out of room. The app's own refusal names the remedy. */
	| 'device_full'
	/** The vault is at its page cap. The app's own refusal names the remedy. */
	| 'vault_full'
	/** A page with this id is already stored. */
	| 'id_collision'
	/** The write was attempted and did not land, for a reason that is not room. */
	| 'write_failed'
	/** Something threw, or the failure carried a code this app does not know. */
	| 'unknown';

/** Whether the reader is offered a button, and what it does. */
export type StorageRetry =
	/** Retrying reproduces the same failure. The sentence carries the remedy instead. */
	| { kind: 'none' }
	/**
	 * Pressing again is worth it, and free.
	 *
	 * Deliberately unlike `GenerationFailure`'s retry, which has an `after` variant and a wait to
	 * describe. Storage has no quota window to respect and no provider to be patient with, so there
	 * is no instant to name and nothing to count down to.
	 */
	| { kind: 'now' };

export type StorageFailure = {
	cause: StorageFailureCause;
	/** What the reader is told. Written to be read, and never an exception's own words. */
	message: string;
	retry: StorageRetry;
	/**
	 * The developer's string, kept for System Trace and a bug report.
	 *
	 * Never rendered as the reader's sentence. `null` where there was nothing underneath — a plain
	 * capacity refusal is fully described by its own message.
	 */
	detail: string | null;
};

/**
 * Every sentence this app already wrote for a reader about a storage refusal.
 *
 * Membership is checked by exact equality against these constants, never by pattern, for the reason
 * in this file's invariants: `vaultLinkFor` matches the same strings exactly.
 */
const AUTHORED_REFUSALS: readonly string[] = [
	VAULT_RECORD_CAP_REFUSAL,
	VAULT_DEVICE_FULL_REFUSAL,
	VAULT_ID_COLLISION_REFUSAL
];

/**
 * The adapter's codes, mapped to the distinctions that change what a reader should do.
 *
 * All nine of them: the seven in `src/lib/adapters/creation-store-seam/index.ts` plus the two in its
 * `REFUSAL_CODES`. `tests/unit/storage-failure.test.ts` reads that adapter and fails if it ever
 * emits a code this table does not name, so a new failure mode cannot quietly land in `unknown` —
 * which is the branch that offers a retry, and therefore the one place a wrong default would invite
 * a reader to press a button against a condition that cannot change.
 */
const CAUSE_BY_CODE: Record<string, StorageFailureCause> = {
	BROWSER_REQUIRED: 'unavailable',
	STORAGE_PARSE_FAILED: 'unreadable',
	STORAGE_SCHEMA_MISMATCH: 'unreadable',
	DRAFT_SCHEMA_MISMATCH: 'unreadable',
	CREATION_SCHEMA_MISMATCH: 'rejected',
	STORAGE_FULL: 'device_full',
	VAULT_FULL: 'vault_full',
	VAULT_ID_COLLISION: 'id_collision',
	STORAGE_WRITE_FAILED: 'write_failed'
};

/** What the reader loses, named per operation, so one sentence never has to cover two stakes. */
const SUBJECT: Record<StorageOperation, string> = {
	read: 'Your saved pages could not be read.',
	save: 'This page could not be saved to the vault.',
	delete: 'This page could not be deleted.',
	restore: 'This page could not be put back.',
	pin: 'This page could not be pinned.',
	unpin: 'This page could not be unpinned.',
	draft: 'Your work in progress could not be saved on this device.'
};

/**
 * How the reader can keep the work this failure puts at risk, if they can at all.
 *
 * A failed `read`, `delete` or pin change threatens nothing the reader is holding — the pages are
 * still stored, or still stored *because* the delete failed. A failed `save` or `restore` means a
 * finished page on screen has nowhere to go, and that page has a download.
 *
 * A failed `draft` is the case this got wrong at first. It was told to "download it", and there is
 * nothing to download: a draft is the evidence, dedication and controls the reader is still typing,
 * and `StudioInputPanel` offers no export of any of it. Naming a remedy the surface cannot perform
 * is the same defect as naming none — so the draft says the thing that is actually available.
 */
const KEEP_INSTRUCTION: Record<StorageOperation, string> = {
	read: '',
	save: ' Download it to keep it, in case this does not clear.',
	delete: '',
	restore: ' Download it to keep it, in case this does not clear.',
	pin: '',
	unpin: '',
	draft: ' Nothing typed here is lost while this page stays open, but it will not come back after a refresh — copy anything you cannot retype.'
};

/**
 * What a reader can do about a browser that refuses storage entirely.
 *
 * Named as a setting rather than a step-by-step, because the setting is called something different
 * in every browser and a wrong instruction is worse than a described one.
 */
const ALLOW_SITE_DATA = 'Check that your browser allows site data for this site, then try again.';

/**
 * The two things `unreadable` can mean, in the order it is safe to try them.
 *
 * It cannot be narrowed to one, and this sentence used to claim it could. `readJson` in
 * `src/lib/adapters/creation-store-seam/index.ts` wraps `localStorage.getItem` and `JSON.parse` in
 * ONE try/catch and reports both as `STORAGE_PARSE_FAILED` — so a browser blocking site data and a
 * genuinely damaged store are indistinguishable at this code. The first draft of this message said
 * only the second thing and told the reader to clear their site data: **destructive advice, given
 * on a guess, to a reader whose saved pages were fine.**
 *
 * So both are named, the harmless check first, and the destructive one is explicitly conditional on
 * the harmless one being ruled out. Telling the reader what this app cannot distinguish beats
 * picking one and sounding certain.
 */
const UNREADABLE_REMEDY =
	'That is either because this browser is blocking site data for this site, or because what is ' +
	'stored here cannot be read. Check the site-data setting first and try again. If it is already ' +
	"allowed, the stored data is damaged, and clearing this site's stored data is the only fix — " +
	'which also removes any pages saved here.';

/**
 * The two things a failed write can mean, for the same reason.
 *
 * `writeJson`'s generic branch reports `STORAGE_WRITE_FAILED`, and its own comment says that branch
 * covers "a `SecurityError` from a browser with site data blocked, where nothing the reader deletes
 * helps". Promising only that a retry is free would leave that reader pressing a button that fails
 * identically every time, with the one remedy that works unmentioned.
 */
const WRITE_FAILED_REMEDY =
	'Trying again costs nothing — the vault is on this device, not sent anywhere. If it keeps ' +
	'failing, check that your browser allows site data for this site.';

/** The exception's own words, reduced to a string, for `detail` and never for `message`. */
const detailOf = (error: unknown): string | null => {
	if (error instanceof Error && error.message.length > 0) return error.message;
	if (typeof error === 'string' && error.length > 0) return error;
	return null;
};

/** A `SeamError`-shaped value, recognised without trusting that it is one. */
const asSeamError = (error: unknown): { code: string; message: string } | null => {
	if (typeof error !== 'object' || error === null) return null;
	const candidate = error as { code?: unknown; message?: unknown };
	if (typeof candidate.code !== 'string' || candidate.code.length === 0) return null;
	if (typeof candidate.message !== 'string') return null;
	// An `Error` can carry a `code` (Node sets one on system errors) and would otherwise be read as
	// a seam refusal, which would put its own message on screen through the allowlist branch below.
	// That is the single hole through which an exception's words could reach a reader, so it is
	// closed here rather than downstream.
	if (error instanceof Error) return null;
	return { code: candidate.code, message: candidate.message };
};

/**
 * What to tell the reader, and whether to offer the button.
 *
 * Split from `classifyStorageFailure` so the sentence for a cause is decided in one expression that
 * can be read top to bottom, rather than assembled across the branches that detect the cause.
 */
const describe = (
	cause: StorageFailureCause,
	operation: StorageOperation
): { message: string; retry: StorageRetry } => {
	const subject = SUBJECT[operation];
	const keepIt = KEEP_INSTRUCTION[operation];
	switch (cause) {
		case 'unavailable':
			// A retry, because the sentence asks the reader to change a setting and pressing the
			// button is how they find out whether it took. `BROWSER_REQUIRED` is emitted when
			// `localStorage` is absent entirely, which a reader can genuinely turn back on — this is
			// not a condition that provably cannot change, which is the bar for withholding a retry.
			return { message: `${subject} ${ALLOW_SITE_DATA}${keepIt}`, retry: { kind: 'now' } };
		case 'unreadable':
			// A retry, for the same reason and only since this stopped claiming to know which of the
			// two causes it is. If the store is blocked, allowing site data and pressing again works;
			// if it is genuinely damaged, this fails again and the sentence's second half is the
			// answer. Withholding the button would serve only the second case, and the message can
			// no longer tell the reader which one they are in.
			return { message: `${subject} ${UNREADABLE_REMEDY}${keepIt}`, retry: { kind: 'now' } };
		case 'rejected':
			// No retry: the same value would be built and refused again. Says plainly that the
			// reader's own stored pages are untouched, because every other sentence on this list
			// implies the device is at fault and this one is the app's fault alone.
			return {
				message:
					`${subject} It was refused for its own contents, so trying again would ` +
					`produce the same result. Nothing already saved was affected.${keepIt}`,
				retry: { kind: 'none' }
			};
		case 'write_failed':
		case 'unknown':
			// A write can miss for a transient reason, the page is still on screen, and pressing
			// again spends nothing — but this branch also catches a browser blocking site data, so
			// the sentence names that too rather than promising only that the retry is free.
			return { message: `${subject} ${WRITE_FAILED_REMEDY}${keepIt}`, retry: { kind: 'now' } };
		// The three capacity refusals never reach here: `classifyStorageFailure` returns the app's
		// own sentence for them before calling this. Reaching this point would mean a code mapped to
		// a capacity cause arrived carrying a message the app did not write, so say the true thing
		// rather than inventing a count this function cannot know.
		case 'device_full':
		case 'vault_full':
		case 'id_collision':
			return { message: `${subject}${keepIt}`, retry: { kind: 'none' } };
	}
};

/**
 * What a reader is told when a storage operation fails.
 *
 * `error` is deliberately `unknown`: the two worst call sites this replaces were `catch` blocks
 * writing `error.message` onto the screen, and a classifier that only accepted a well-formed
 * `SeamError` would have left them exactly as they were.
 */
export const classifyStorageFailure = (
	operation: StorageOperation,
	error: unknown
): StorageFailure => {
	const seamError = asSeamError(error);
	if (seamError) {
		// The app's own sentence, returned verbatim and with no subject prefixed. These already say
		// what happened and what to do, and `vaultLinkFor` matches them exactly.
		if (AUTHORED_REFUSALS.includes(seamError.message)) {
			return {
				cause: CAUSE_BY_CODE[seamError.code] ?? 'unknown',
				message: seamError.message,
				retry: { kind: 'none' },
				detail: null
			};
		}
		const cause = CAUSE_BY_CODE[seamError.code] ?? 'unknown';
		return {
			...describe(cause, operation),
			cause,
			// The seam's own message is diagnostic, not reader-facing. It goes where the exception's
			// words go.
			detail: seamError.message.length > 0 ? seamError.message : null
		};
	}
	return { ...describe('unknown', operation), cause: 'unknown', detail: detailOf(error) };
};

/**
 * A refusal whose sentence this app wrote at the call site, wrapped so the notice can render it.
 *
 * For the one branch that knows something the classifier cannot: `undoDelete` refusing for a full
 * vault says that the page being refused is the one Undo is still holding and about to lose, which
 * is not a fact about storage at all. Wrapping it here rather than letting that branch keep its own
 * `<p class="error">` is the whole point — one rendering, and a sentence that is still the call
 * site's to write.
 *
 * Always `cause: 'vault_full'` and never a retry: the only caller is a capacity refusal, and a
 * button that re-attempts a write the vault has no room for would fail identically.
 */
export const authoredStorageRefusal = (message: string): StorageFailure => ({
	cause: 'vault_full',
	message,
	retry: { kind: 'none' },
	detail: null
});

/**
 * The label on the retry control, or `null` where no control should be rendered.
 *
 * Names the operation rather than saying "Try again", because on the vault page several of these
 * notices can be on screen at once and a row of identical buttons says nothing about which page each
 * one would act on.
 */
export const storageRetryLabel = (
	failure: StorageFailure,
	operation: StorageOperation
): string | null => {
	if (failure.retry.kind !== 'now') return null;
	switch (operation) {
		case 'read':
			return 'Read them again';
		case 'save':
			return 'Save it again';
		// "Try deleting again", not "Delete it again": the delete never happened, and a label that
		// implies it did would read as an offer to delete a second copy.
		case 'delete':
			return 'Try deleting again';
		case 'restore':
			return 'Try putting it back';
		case 'pin':
			return 'Try pinning again';
		case 'unpin':
			return 'Try unpinning again';
		case 'draft':
			return 'Save the draft again';
	}
};
