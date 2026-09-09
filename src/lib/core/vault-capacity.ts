// Purpose: Decide whether a page can be written to the Quote Vault, and say what a reader can do
//          when it cannot — without ever removing a page they already saved.
// Why: The vault enforced its capacity in the wrong unit. `upsertRecord` kept the newest
//      `MAX_CREATIONS` records and dropped the rest (`[record, ...filtered].slice(0, 50)`), so the
//      51st save destroyed the first one and still reported "Saved to the vault." — a confirmation
//      for an operation that had just deleted a page. Two things were wrong with that beyond the
//      lie. `favorite` — the reader's one "keep this one" control — was read by nothing in that
//      expression, so a pinned page was evicted exactly like any other. And the boundary being
//      defended is not the one a reader ever reaches: a real captured provider image in
//      `fixtures/image-generation/sample.json` is 236,380 base64 characters, so fifty of them
//      cannot fit in a browser's localStorage at all. The reader runs out of BYTES long before
//      they run out of records, and that arrival was reported as
//      "Failed to write storage for cb_creations_v1."
// Info flow: stored records + the record being saved -> a write plan, or a refusal carrying the
//            sentence the surface shows -> the adapter writes or reports.
// Invariants:
//   - Nothing already saved is ever removed to make room for a new page. A save that cannot fit is
//     refused, and the refusal says what to delete. The page being refused is still on screen and
//     still downloadable; the pages it would have evicted are not recoverable, so the reader keeps
//     the ones they cannot get back. This is why there is no eviction ordering here at all: with no
//     eviction there is no pinned page to protect, which is the whole of the `favorite` defect.
//   - Replacing a record already in the store is NEVER a capacity question. `toggleFavorite` and
//     `undoDelete` both reach `saveCreation` with an id that is already stored, and refusing a pin
//     because the vault is full would break the one control a reader has for organising a full
//     vault.
//   - The record cap is counted against the SAVING OWNER's records, not the whole stored array.
//     The store is capped globally today while `listCreations` filters by owner, so a reader whose
//     `cb_session_id_v1` was cleared has records they cannot see, cannot delete, and which counted
//     against them. Refusing such a reader with "your vault already holds 50 pages" while the vault
//     shows nine would be a worse sentence than the silent eviction it replaces.
import type {
	CreationOwner,
	CreationRecord
} from '../../../contracts/creation-store.contract';
import { MAX_CREATIONS } from '../../../contracts/creation-store.contract';

/** How many saved pages one owner may keep. Re-exported so callers need not know where it lives. */
export { MAX_CREATIONS };

/**
 * Whether a stored record belongs to the owner doing the saving.
 *
 * Lived in the adapter as a module-private `ownerMatches`, which is why the capacity rule above it
 * could not use it and counted the whole array instead. One definition, so the count that refuses a
 * save and the filter that builds the list cannot disagree about whose pages they are.
 */
export const ownerMatches = (
	record: CreationRecord,
	owner: CreationOwner
): boolean => {
	if (record.owner.kind === 'anonymous' && owner.kind === 'anonymous') {
		return record.owner.sessionId === owner.sessionId;
	}
	if (record.owner.kind === 'authenticated' && owner.kind === 'authenticated') {
		return record.owner.userId === owner.userId;
	}
	return false;
};

/**
 * The vault holds as many pages as this browser keeps, and the reader must free one.
 *
 * Says "Nothing was removed" explicitly. The behaviour this replaces removed a page and said
 * nothing, so the first thing a reader needs to know about the new refusal is that the silent
 * deletion did not happen — otherwise the natural reading of any failure here is that something
 * went wrong with their saved pages.
 */
export const VAULT_RECORD_CAP_REFUSAL =
	`Your vault already holds ${MAX_CREATIONS} saved pages, which is as many as this browser ` +
	'keeps. Nothing was removed. Delete a saved page to make room for this one.';

/**
 * The device is out of storage, which is the limit a reader actually reaches.
 *
 * `localStorage.setItem` either writes the whole value or throws, so a quota failure leaves every
 * previously saved page exactly as it was — which is what "nothing already saved was lost" is
 * asserting, rather than reassuring. Deliberately does not name a number of pages: the ceiling is
 * bytes, it depends on the size of the pictures already stored, and inventing a page count for it
 * would be the same kind of fiction as capping at fifty.
 */
export const VAULT_DEVICE_FULL_REFUSAL =
	'There is no room left on this device for another saved page. Nothing already saved was lost. ' +
	'Delete a saved page to make room for this one.';

/** Every refusal that a reader clears by freeing space in the vault. */
export const VAULT_MAKE_ROOM_REFUSALS: readonly string[] = [
	VAULT_RECORD_CAP_REFUSAL,
	VAULT_DEVICE_FULL_REFUSAL
];

/**
 * A quota failure, told apart from every other reason a write can throw.
 *
 * The distinction is load-bearing: "this device is out of room, delete a page" is actionable, and
 * "the store could not be written" is not, so collapsing them — which is what the single
 * `STORAGE_WRITE_FAILED` did — costs the reader the only remedy they have. Browsers disagree about
 * how they signal it, so all three known signatures are checked: the standard `QuotaExceededError`
 * name, Firefox's `NS_ERROR_DOM_QUOTA_REACHED`, and the legacy numeric codes (22 in Chrome and
 * Safari, 1014 in older Firefox) that older engines set instead of a recognisable name.
 *
 * `DOMException` is feature-detected rather than assumed: this predicate is unit-tested in Node,
 * where the global may not exist, and a bare `instanceof` against a missing global throws.
 */
export const isStorageFullError = (error: unknown): boolean => {
	const QUOTA_NAMES = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'];
	if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
		return QUOTA_NAMES.includes(error.name) || error.code === 22 || error.code === 1014;
	}
	// Some engines and test doubles throw a plain `Error` carrying the same name.
	return error instanceof Error && QUOTA_NAMES.includes(error.name);
};

/** What a write should do: the exact array to store, or the reason it must not be attempted. */
export type VaultWritePlan =
	| { ok: true; records: CreationRecord[] }
	| { ok: false; reason: 'RECORD_CAP'; message: string };

/**
 * Work out the array a save should store, or refuse it.
 *
 * The returned array is the whole store — every owner's records, not just the saver's — because
 * that is what gets written back. Only the *count* is owner-scoped; the write is not, or one
 * reader's save would delete another session's pages, which is the failure this module exists to
 * remove rather than relocate.
 *
 * A replacement keeps the incoming record at the front, which is what the slicing version did. The
 * order stored here is not the order anyone reads: `buildVaultEntries` sorts by pin and by
 * `createdAtISO`, so this is only about which array position a rewritten record occupies.
 */
export const planCreationWrite = (
	stored: readonly CreationRecord[],
	incoming: CreationRecord
): VaultWritePlan => {
	const others = stored.filter((existing) => existing.id !== incoming.id);
	const isReplacement = others.length !== stored.length;
	if (!isReplacement) {
		const ownedCount = others.filter((existing) =>
			ownerMatches(existing, incoming.owner)
		).length;
		if (ownedCount >= MAX_CREATIONS) {
			return {
				ok: false,
				reason: 'RECORD_CAP',
				message: VAULT_RECORD_CAP_REFUSAL
			};
		}
	}
	return { ok: true, records: [incoming, ...others] };
};
