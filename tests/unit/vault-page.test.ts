// Purpose: Unit tests for the vault's address, its ordering, and the sentences it says about
//          itself.
// Why: The vault had no address, and every sentence it said lived inline in one component, so no
//      other surface could say it and nothing could test it. These pin the parts that now let the
//      home card and the `/vault` route be the same answer rendered twice — and the ordering rules
//      that a list of fifty needs and a preview of four never did.
// Info flow: entries / counts / ids -> pure transforms -> assertions.
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_VAULT_SORT,
	VAULT_EMPTY,
	VAULT_PATH,
	VAULT_REOPEN_PARAM,
	VAULT_SAVED_CONFIRMATION,
	VAULT_SORT_OPTIONS,
	VAULT_UNREADABLE,
	asVaultSortOrder,
	describeVaultCount,
	showsVaultLink,
	sortVaultEntries,
	vaultFullRefusal,
	vaultNoMatches,
	vaultReopenHref
} from '../../src/lib/core/vault-page';
import { VAULT_CAPACITY, type VaultEntry } from '../../src/lib/core/vault-gallery';
import type { CreationRecord } from '../../src/lib/seams/creation-store-seam/contract';

const entry = (
	id: string,
	title: string,
	createdAtISO: string,
	favorite = false
): VaultEntry => ({
	id,
	title,
	quote: '',
	savedLabel: 'Saved today',
	imageSource: '',
	downloadName: `${id}.png`,
	itemCount: 0,
	favorite,
	record: { id, createdAtISO } as unknown as CreationRecord
});

describe('the vault has an address', () => {
	it('reopens a saved page on the studio, carrying its id', () => {
		expect(vaultReopenHref('creation-7')).toBe(`/?${VAULT_REOPEN_PARAM}=creation-7`);
	});

	it('escapes an id rather than pasting it into a query string', () => {
		// Ids are generated, but a stored record's id arrives from this device's storage and is not
		// this module's to trust. An `&` would otherwise end the parameter early.
		expect(vaultReopenHref('a&b=c d')).toBe(`/?${VAULT_REOPEN_PARAM}=a%26b%3Dc%20d`);
	});

	it('names one path, so a link and a route cannot disagree', () => {
		expect(VAULT_PATH).toBe('/vault');
	});
});

describe('what the vault says about itself', () => {
	it('says nothing at all about an empty vault', () => {
		// The count is a badge beside the heading; "0 saved" beside "No saved pages yet" is the
		// same fact twice.
		expect(describeVaultCount(0, 0, '')).toBe('');
	});

	it('counts the pages when nothing is being searched for', () => {
		expect(describeVaultCount(7, 7, '')).toBe('7 saved');
	});

	it('keeps the two numbers apart while a search is narrowing the list', () => {
		// The card used to render only the total, so searching left "12 saved" above three rows.
		expect(describeVaultCount(12, 3, 'rent')).toBe('3 of 12 saved');
	});

	it('does not say "7 of 7" when the search matches everything', () => {
		expect(describeVaultCount(7, 7, 'a')).toBe('7 saved');
	});

	it('treats a whitespace-only search as no search', () => {
		expect(describeVaultCount(4, 4, '   ')).toBe('4 saved');
	});

	it('quotes the search back without its surrounding whitespace', () => {
		expect(vaultNoMatches('  rent  ')).toBe('Nothing in the vault matches "rent".');
	});

	it('never tells a reader with unreadable storage that their pages are gone', () => {
		expect(VAULT_UNREADABLE).toContain('not gone');
		expect(VAULT_EMPTY).not.toBe(VAULT_UNREADABLE);
	});

	it('refuses a restore by naming the page and the real cost, not a move that destroys it', () => {
		const refusal = vaultFullRefusal('THE RENT');
		expect(refusal).toContain('THE RENT');
		expect(refusal).toContain(String(VAULT_CAPACITY));
		expect(refusal).toContain('Download the page you want to keep');
		// The instruction that would discard the very record being rescued: deleting another page
		// replaces what Undo is holding.
		expect(refusal).not.toContain('then undo');
	});

	it('offers the vault link only for the confirmation, never for a failure that says "vault"', () => {
		expect(showsVaultLink(VAULT_SAVED_CONFIRMATION)).toBe(true);

		// The same line carries every failure the save can produce, and several of them say the
		// word "vault" while meaning the page never got there. A substring search would send the
		// reader off to look for something that was never written.
		for (const failure of [
			'Failed to save to vault.',
			'Could not write to the vault.',
			'Session is still connecting. Try again in a moment.',
			'Quote copied.',
			''
		]) {
			expect(showsVaultLink(failure), failure).toBe(false);
		}
	});

	it('confirms a save without naming a page to go and look at it on', () => {
		// The whole defect: twelve surfaces said "Find it on the home page", which is a navigation
		// instruction rather than a link. The link is rendered beside this, not written into it.
		expect(VAULT_SAVED_CONFIRMATION).not.toContain('home page');
	});
});

describe('ordering the vault', () => {
	const entries = [
		entry('c', 'Beta', '2026-09-03T00:00:00.000Z', true),
		entry('a', 'alpha', '2026-09-01T00:00:00.000Z'),
		entry('b', 'Gamma', '2026-09-05T00:00:00.000Z')
	];

	it('leaves the pinned-first order exactly as the entries arrived', () => {
		// `buildVaultEntries` already produces pinned-first, newest-next. Re-sorting here would be a
		// second copy of that rule, free to disagree with the first.
		expect(sortVaultEntries(entries, 'pinned').map((item) => item.id)).toEqual(['c', 'a', 'b']);
	});

	it('never mutates the list it was given', () => {
		const original = [...entries];
		sortVaultEntries(entries, 'newest');
		expect(entries).toEqual(original);
	});

	it('puts the newest first, ignoring pins', () => {
		expect(sortVaultEntries(entries, 'newest').map((item) => item.id)).toEqual(['b', 'c', 'a']);
	});

	it('puts the oldest first', () => {
		expect(sortVaultEntries(entries, 'oldest').map((item) => item.id)).toEqual(['a', 'c', 'b']);
	});

	it('sorts by title without letting case decide the order', () => {
		expect(sortVaultEntries(entries, 'title').map((item) => item.id)).toEqual(['a', 'c', 'b']);
	});

	it('breaks a tie on id, so a re-render cannot shuffle two pages saved in the same instant', () => {
		const sameInstant = [
			entry('z', 'Same', '2026-09-04T00:00:00.000Z'),
			entry('y', 'Same', '2026-09-04T00:00:00.000Z')
		];
		expect(sortVaultEntries(sameInstant, 'newest').map((item) => item.id)).toEqual(['y', 'z']);
		expect(sortVaultEntries(sameInstant, 'title').map((item) => item.id)).toEqual(['y', 'z']);
	});

	it('sorts a record with an unparseable date to the epoch rather than scrambling the list', () => {
		// `NaN` from a comparator makes the *whole* sort implementation-defined, not just the one
		// row's position. Measured on this runtime with the guard removed: `oldest` returned
		// `a,c,b,bad` — the corrupt row last, where the epoch puts it first — and on a
		// thirteen-row list it came back in the *middle* (`…r4,bad,r5…`), which is the shape of
		// the real damage. Both orders are asserted here because only `oldest` discriminates: the
		// four-row `newest` case happens to return the same list either way, and asserting only
		// that is a test that pins nothing.
		const withCorrupt = [...entries, entry('bad', 'Corrupt', 'not-a-date')];

		expect(sortVaultEntries(withCorrupt, 'oldest').map((item) => item.id)).toEqual([
			'bad',
			'a',
			'c',
			'b'
		]);
		expect(sortVaultEntries(withCorrupt, 'newest').map((item) => item.id)).toEqual([
			'b',
			'c',
			'a',
			'bad'
		]);
	});

	it('offers every order it can apply, and no order it cannot', () => {
		// Fails if an option is added to the list without `sortVaultEntries` learning to apply it.
		for (const option of VAULT_SORT_OPTIONS) {
			expect(sortVaultEntries(entries, option.id)).toHaveLength(entries.length);
			expect(asVaultSortOrder(option.id)).toBe(option.id);
		}
	});

	it('falls back to the default order for anything that is not one', () => {
		// The value arrives from a select element, and a stored or tampered value is not an order.
		expect(asVaultSortOrder('')).toBe(DEFAULT_VAULT_SORT);
		expect(asVaultSortOrder('newest-ish')).toBe(DEFAULT_VAULT_SORT);
		expect(asVaultSortOrder('__proto__')).toBe(DEFAULT_VAULT_SORT);
	});
});
