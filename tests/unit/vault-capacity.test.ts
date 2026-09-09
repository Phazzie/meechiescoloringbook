// Purpose: Unit tests for the rule that decides whether a saved page can be written.
// Why: The rule this replaces was one expression — `[record, ...filtered].slice(0, MAX_CREATIONS)`
//      — and every one of its defects was a thing it silently did rather than a thing it said. It
//      deleted the reader's oldest saved page, ignored `favorite` while doing so, counted every
//      owner's records against one reader, and returned `ok` afterwards so all fifteen surfaces
//      reported "Saved to the vault." These are the claims that expression could not make.
// Info flow: stored records + an incoming record -> planCreationWrite -> a write plan or a refusal.
import { describe, expect, it } from 'vitest';
import {
	MAX_CREATIONS,
	VAULT_DEVICE_FULL_REFUSAL,
	VAULT_RECORD_CAP_REFUSAL,
	isStorageFullError,
	ownerMatches,
	planCreationWrite
} from '../../src/lib/core/vault-capacity';
import type {
	CreationOwner,
	CreationRecord
} from '../../src/lib/seams/creation-store-seam/contract';

const owner = (sessionId: string): CreationOwner => ({
	kind: 'anonymous',
	sessionId
});

const READER = owner('reader');
const STRANGER = owner('a-cleared-session');

const record = (
	id: string,
	overrides: Partial<CreationRecord> = {}
): CreationRecord =>
	({
		id,
		createdAtISO: '2026-09-09T00:00:00.000Z',
		intent: { title: id },
		assembledPrompt: 'Black and white line art coloring page.',
		owner: READER,
		...overrides
	}) as CreationRecord;

/** A full vault for one owner, newest first, exactly as the store holds it. */
const fullVaultFor = (recordOwner: CreationOwner): CreationRecord[] =>
	Array.from({ length: MAX_CREATIONS }, (_unused, index) =>
		record(`page-${index}`, { owner: recordOwner })
	);

describe('planCreationWrite', () => {
	it('keeps every stored page when it accepts a new one', () => {
		const stored = [record('older'), record('oldest')];

		const plan = planCreationWrite(stored, record('newest'));

		expect(plan.ok).toBe(true);
		if (!plan.ok) return;
		expect(plan.records.map((entry) => entry.id)).toEqual([
			'newest',
			'older',
			'oldest'
		]);
	});

	it('refuses a save that would not fit rather than deleting a page to make it fit', () => {
		const stored = fullVaultFor(READER);

		const plan = planCreationWrite(stored, record('one-too-many'));

		// The whole point. The old rule returned a 50-long array with `page-49` missing and no
		// indication that it had gone, so the surface above it said "Saved to the vault."
		expect(plan.ok).toBe(false);
		if (plan.ok) return;
		expect(plan.reason).toBe('RECORD_CAP');
		expect(plan.message).toBe(VAULT_RECORD_CAP_REFUSAL);
	});

	it('never drops a pinned page, because it never drops a page at all', () => {
		// `favorite` is the reader's one "keep this one" control, and the rule this replaces did
		// not read it: the oldest record went whether it was pinned or not. Stated as the invariant
		// that actually holds now — everything stored is still stored — rather than as an eviction
		// ordering, because there is no eviction left to order.
		const stored = fullVaultFor(READER);
		stored[stored.length - 1] = record('pinned-and-oldest', {
			favorite: true
		});

		const plan = planCreationWrite(stored, record('one-too-many'));

		expect(plan.ok).toBe(false);
		const kept = planCreationWrite(stored.slice(1), record('fits'));
		expect(kept.ok).toBe(true);
		if (!kept.ok) return;
		expect(kept.records.map((entry) => entry.id)).toContain('pinned-and-oldest');
	});

	it('counts only the saving reader when deciding whether they are full', () => {
		// The store is one array shared by every session that has ever used this browser, while
		// `listCreations` filters by owner. Counting the array meant a reader whose
		// `cb_session_id_v1` was cleared could be refused with "your vault already holds 50 pages"
		// while their vault showed one.
		const stored = [...fullVaultFor(STRANGER), record('mine')];

		const plan = planCreationWrite(stored, record('also-mine'));

		expect(plan.ok).toBe(true);
	});

	it('writes back every owner’s records, not just the saving reader’s', () => {
		// The count is owner-scoped; the write is not. Filtering the array to one owner on the way
		// out would relocate the data loss rather than remove it — one reader's save would delete
		// another session's pages outright.
		const stored = [record('theirs', { owner: STRANGER }), record('mine')];

		const plan = planCreationWrite(stored, record('new'));

		expect(plan.ok).toBe(true);
		if (!plan.ok) return;
		expect(plan.records.map((entry) => entry.id).sort()).toEqual([
			'mine',
			'new',
			'theirs'
		]);
	});

	it('lets a full vault be pinned, renamed and re-saved in place', () => {
		// `toggleFavorite` and `undoDelete` both reach the store through `saveCreation` with an id
		// that is already there. Treating a replacement as a capacity question would disable the
		// one control a reader has for organising the vault at exactly the moment it fills up —
		// they could no longer pin anything, which is the state that makes pinning matter.
		const stored = fullVaultFor(READER);
		const pinned = { ...stored[10], favorite: true };

		const plan = planCreationWrite(stored, pinned);

		expect(plan.ok).toBe(true);
		if (!plan.ok) return;
		expect(plan.records).toHaveLength(MAX_CREATIONS);
		expect(plan.records[0]?.favorite).toBe(true);
		// Replaced, not added alongside itself.
		expect(plan.records.filter((entry) => entry.id === pinned.id)).toHaveLength(1);
	});
});

describe('ownerMatches', () => {
	it('matches an owner to their own records and to nobody else’s', () => {
		expect(ownerMatches(record('a'), READER)).toBe(true);
		expect(ownerMatches(record('a'), STRANGER)).toBe(false);
	});

	it('never matches an anonymous session to an authenticated user', () => {
		// Two different identity kinds that both carry a string. Comparing the strings without
		// comparing the kinds would let a session id equal to a user id read one reader's vault.
		const authenticated = {
			kind: 'authenticated',
			userId: 'reader'
		} as const satisfies CreationOwner;

		expect(ownerMatches(record('a', { owner: READER }), authenticated)).toBe(false);
		expect(ownerMatches(record('a', { owner: authenticated }), READER)).toBe(false);
	});
});

describe('isStorageFullError', () => {
	it('recognises every signature browsers use for a full store', () => {
		// The limit a reader actually reaches. A real captured provider image in
		// `fixtures/image-generation/sample.json` is 236,380 base64 characters, so a browser runs
		// out of bytes long before it runs out of the 50 record slots above.
		const named = new Error('full');
		named.name = 'QuotaExceededError';
		const firefox = new Error('full');
		firefox.name = 'NS_ERROR_DOM_QUOTA_REACHED';

		expect(isStorageFullError(named)).toBe(true);
		expect(isStorageFullError(firefox)).toBe(true);
	});

	it('does not mistake any other write failure for a full store', () => {
		// A `SecurityError` is a browser with site data blocked. Deleting a saved page does nothing
		// about it, so telling the reader to go and delete one would be the wrong instruction —
		// which is the whole reason these two are told apart.
		const blocked = new Error('denied');
		blocked.name = 'SecurityError';

		expect(isStorageFullError(blocked)).toBe(false);
		expect(isStorageFullError(new Error('boom'))).toBe(false);
		expect(isStorageFullError('QuotaExceededError')).toBe(false);
		expect(isStorageFullError(null)).toBe(false);
		expect(isStorageFullError(undefined)).toBe(false);
	});
});

describe('the sentences a refused save shows', () => {
	it('says what to do, and does not invent a page count for the device limit', () => {
		expect(VAULT_RECORD_CAP_REFUSAL).toContain(String(MAX_CREATIONS));
		// The device ceiling is bytes and depends on the size of the pictures already stored.
		// Naming a number of pages for it would be the same fiction as capping at fifty.
		expect(VAULT_DEVICE_FULL_REFUSAL).not.toContain(String(MAX_CREATIONS));
		expect(VAULT_DEVICE_FULL_REFUSAL).toMatch(/room/i);
	});
});
