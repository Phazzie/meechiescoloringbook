/*
 * Purpose: The Quote Vault itself — the saved pages, and every operation on the collection of them.
 * Why: The vault's list, search, pin, two-step delete and undo lived inside `StudioState`, a
 *      2,600-line class that also generates pages, tries wigs on and talks to four providers. So
 *      the only surface that could show a reader their saved pages was the one page that
 *      instantiates it — the home studio — and the twelve other surfaces that write to the vault
 *      could only tell the reader to go and look there. Owning the collection here is what lets a
 *      route with no studio in it render the same vault, with the same rules, from the same code.
 * Info flow: CreationStoreSeam -> sorted CreationRecord[] -> vault-gallery's pure transforms ->
 *            VaultEntry[] the UI renders; a delete or a pin goes back out through the same seam.
 * Invariants: Every operation reports its own failure. A read failure is tracked apart from every
 *             other failure, because only a read failure means "your pages are still there". A
 *             delete is always two-step and always recoverable.
 */
import { appOriginSeam } from '$lib/adapters/app-origin-seam';
import { clockSeam } from '$lib/adapters/clock-seam';
import { creationStoreAdapter } from '$lib/adapters/creation-store-seam';
import { pageVisibilitySeam } from '$lib/adapters/page-visibility-seam';
import { sessionAdapter } from '$lib/adapters/session-seam';
import {
	VAULT_CAPACITY,
	buildVaultEntries,
	buildVaultEntry,
	sortVaultCreations
} from '$lib/core/vault-gallery';
import { vaultFullRefusal } from '$lib/core/vault-page';
import { VAULT_MAKE_ROOM_REFUSALS } from '$lib/core/vault-capacity';
import type { AppOriginSeam } from '$lib/seams/app-origin-seam/contract';
import { nextUtcDayBoundary, type ClockSeam } from '$lib/seams/clock-seam/contract';
import type { CreationOwner, CreationRecord } from '$lib/seams/creation-store-seam/contract';
import type { PageVisibilitySeam } from '$lib/seams/page-visibility-seam/contract';

/**
 * The saved pages, and what a reader can do to them.
 *
 * Deliberately knows nothing about generating a page. `StudioState` still owns `saveToVault` and
 * `loadCreation`, because writing a record needs the page that is on screen and reopening one has
 * to put a spec, an image and a set of controls back — both are studio operations that happen to
 * end at the vault. Everything that is about the *collection* is here, so the studio and the
 * `/vault` route cannot answer the same question two different ways.
 */
export class VaultCollection {
	// The three browser integrations this collection needs, each behind its seam and each
	// injectable, exactly as they were on `StudioState`: reading `location`, `Date.now()` or
	// `document.visibilityState` here would be an unseamed browser call, and a test could not
	// drive a UTC day boundary without waiting for a real midnight.
	clock: ClockSeam = clockSeam;
	origin: AppOriginSeam = appOriginSeam;
	visibility: PageVisibilitySeam = pageVisibilitySeam;

	creations = $state<CreationRecord[]>([]);
	query = $state('');
	/** Any vault failure, read or write, in the words the seam used. */
	error = $state('');
	/**
	 * True only when the last vault *read* failed, so the UI can distinguish "your pages are still
	 * there, we could not see them" from any other error that happens to leave the list empty.
	 */
	readFailed = $state(false);
	/** What just happened — saved, deleted, restored, reopened. Not an error; errors are `error`. */
	status = $state('');
	/**
	 * Delete is two-step and reversible: the first click arms `pendingDeleteId`, the second removes
	 * the record but keeps it in `undoableDeletion` so one click puts it back. A saved page costs a
	 * paid generation, so a single mis-tap must never be able to destroy one.
	 */
	pendingDeleteId = $state<string | null>(null);
	undoableDeletion = $state<CreationRecord | null>(null);
	/**
	 * The clock reading behind the "Saved today / 3 days ago" labels. Held as state and refreshed at
	 * each day boundary and on each vault reload, so the labels stay a pure function of an explicit
	 * instant rather than re-reading the clock inside a `$derived` on every keystroke.
	 */
	nowMs = $state(this.clock.now());
	/**
	 * The origin the app is served from, used to decide whether a stored absolute image URL is
	 * same-origin and therefore loadable under the app's `img-src 'self'` CSP.
	 */
	appOrigin = $state(this.origin.getOrigin());

	/** Whose pages these are. Null until a session id is in hand; nothing reads or writes before. */
	owner: CreationOwner | null = null;

	private cancelDayBoundaryRefresh: (() => void) | null = null;
	private stopVisibilityWatch: (() => void) | null = null;

	/** Every saved page the current search matches, pinned first then newest first. */
	entries = $derived(
		buildVaultEntries(this.creations, {
			query: this.query,
			nowMs: this.nowMs,
			appOrigin: this.appOrigin
		})
	);

	/** How many pages are actually in the vault, which is not what the search is showing. */
	totalSavedCount = $derived(this.creations.length);

	/**
	 * The held record rendered the same way a saved row is, so the undo banner can offer a real
	 * Download for it. Without this the page waiting in Undo has no download anywhere — it is out
	 * of `creations`, so no row exists — and when the vault is full `undoDelete` tells the reader to
	 * download the page they want to keep while giving them no way to do it.
	 */
	undoableDeletionEntry = $derived(
		this.undoableDeletion === null
			? null
			: buildVaultEntry(this.undoableDeletion, this.nowMs, this.appOrigin)
	);

	/**
	 * Read the session, take ownership of the pages filed under it, and load them.
	 *
	 * The studio does its own session read because it needs the id for `AuthContextSeam` too; a
	 * surface that only shows the vault calls this and needs nothing else. Both end at the same
	 * `owner` shape, built in one place so the two cannot file pages under different owners.
	 */
	async init(): Promise<void> {
		// Re-read rather than trusting the field initializers: a test or an alternate host may have
		// replaced a seam after construction, and the values captured then would be the default
		// adapters'.
		this.appOrigin = this.origin.getOrigin();
		this.nowMs = this.clock.now();
		this.startSavedLabelRefresh();
		const session = await sessionAdapter.getSession();
		if (session.ok) {
			this.adoptOwner(session.value.sessionId);
		}
		await this.refresh();
	}

	adoptOwner(sessionId: string): void {
		this.owner = { kind: 'anonymous', sessionId };
	}

	async refresh(): Promise<void> {
		if (!this.owner) return;
		const result = await creationStoreAdapter.listCreations({ owner: this.owner });
		if (!result.ok) {
			// Reads used to fail silently, so a browser with unreadable storage showed an empty
			// vault and no reason for it. Say what happened and leave the last good list up.
			this.error = result.error.message;
			// Tracked apart from `error` because only a failed *read* means "your pages are still
			// there, we just could not see them". A failed write — a restore that could not be
			// saved, say — also sets `error` and can also leave the list empty, and telling that
			// reader their pages could not be read would be false.
			this.readFailed = true;
			return;
		}
		this.error = '';
		this.readFailed = false;
		this.nowMs = this.clock.now();
		this.creations = sortVaultCreations(result.value);
	}

	setQuery = (value: string): void => {
		this.query = value;
		// A search that hides the armed row would otherwise leave a delete primed off-screen.
		this.pendingDeleteId = null;
	};

	requestDelete = (id: string): void => {
		this.pendingDeleteId = id;
		this.error = '';
	};

	cancelDelete = (): void => {
		this.pendingDeleteId = null;
	};

	/** Cancels an armed delete without touching anything else. For a list that just changed shape. */
	disarmDelete(): void {
		this.pendingDeleteId = null;
	}

	remove = async (id: string): Promise<void> => {
		const removed = this.creations.find((creation) => creation.id === id) ?? null;
		const result = await creationStoreAdapter.deleteCreation({ id });
		this.pendingDeleteId = null;
		if (!result.ok) {
			this.error = result.error.message;
			return;
		}
		this.error = '';
		// Keep a full copy so Undo can put the exact record back, not a reconstruction of it.
		this.undoableDeletion = removed ? $state.snapshot(removed) : null;
		this.status = removed ? `Deleted "${removed.intent.title}".` : 'Deleted.';
		await this.refresh();
	};

	undoDelete = async (): Promise<void> => {
		const record = this.undoableDeletion;
		if (!record) return;
		// The store keeps a fixed number of records per owner. If the slot freed by the delete has
		// since been taken by a new save, restoring would push the list back over the cap — so the
		// restore would be refused by the store anyway. Saying why here, in a sentence about undo,
		// beats letting the adapter's generic full-vault refusal stand in for it: only this branch
		// knows that the page being refused is one Undo is still holding and about to lose.
		//
		// This count used to be a lower bound rather than an answer, because the adapter capped the
		// whole stored array while `creations` holds only this owner's records — so pages orphaned
		// under a previous `cb_session_id_v1` occupied slots this number could not see. The cap is
		// now counted per owner in `planCreationWrite`, which makes the two exactly agree: this is
		// the same number the store will apply, not an estimate of it.
		if (this.creations.length >= VAULT_CAPACITY) {
			this.error = vaultFullRefusal(record.intent.title);
			return;
		}
		const result = await creationStoreAdapter.saveCreation({ record });
		if (!result.ok) {
			// A store that is out of ROOM lands here rather than in the count guard above: the record
			// cap can be satisfied while the device's bytes are not. Its message is "Delete a saved
			// page to make room for this one." — and following that instruction from here calls
			// `remove`, which overwrites `undoableDeletion` with the page just deleted and destroys
			// the one Undo is holding. The count guard's sentence already carries the warning that
			// deleting to make room costs you this page, so the same warning is given for the same
			// trap arriving by the other door.
			this.error = VAULT_MAKE_ROOM_REFUSALS.includes(result.error.message)
				? vaultFullRefusal(record.intent.title, 'device')
				: result.error.message;
			return;
		}
		this.error = '';
		this.undoableDeletion = null;
		this.status = `Restored "${record.intent.title}".`;
		await this.refresh();
	};

	dismissUndoDelete = (): void => {
		this.undoableDeletion = null;
	};

	toggleFavorite = async (creation: CreationRecord): Promise<void> => {
		const result = await creationStoreAdapter.saveCreation({
			record: { ...$state.snapshot(creation), favorite: !creation.favorite }
		});
		if (!result.ok) {
			this.error = result.error.message;
			return;
		}
		this.error = '';
		await this.refresh();
	};

	// "Saved today" is computed against `nowMs`, which otherwise only advances when the vault is
	// read or written, so a surface left open across UTC midnight keeps showing yesterday's labels.
	// Two things move the clock forward, because the two cases are genuinely different:
	//
	//   - A timer armed at the next UTC day boundary, which re-arms itself for the boundary after
	//     that. This is the case that matters most: a reader who leaves the tab in the foreground
	//     is looking straight at the labels while they go stale, and no event would ever fire.
	//   - `visibilitychange`, for the tab that was suspended in the background. A backgrounded
	//     timer can be throttled or deferred, so the boundary timer alone cannot be relied on to
	//     have fired on time; reading the clock on the way back in fixes the label immediately.
	startSavedLabelRefresh(): void {
		// Idempotent, because it is public and a second host would otherwise have to *know* it may
		// only be called once. Arming twice would overwrite `stopVisibilityWatch` and leave the
		// first subscription attached for the life of the tab with nothing holding a handle to it —
		// `destroy()` can only cancel the one it can still see. No production path calls this twice
		// today (raised on PR #331 as hardening, not as a reachable defect), and an assumption that
		// holds only because nobody has broken it yet is worth removing rather than documenting.
		// The day-boundary timer already cancels its own predecessor inside `scheduleNextDay…`.
		this.stopVisibilityWatch?.();
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
		this.cancelDayBoundaryRefresh?.();
		this.cancelDayBoundaryRefresh = null;
		this.stopVisibilityWatch?.();
		this.stopVisibilityWatch = null;
	}
}
