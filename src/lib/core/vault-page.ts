// Purpose: Pure decisions for the Quote Vault as a place — its address, how a saved page is
//          reopened from it, the order the pages are shown in, and every sentence the vault says
//          about its own state.
// Why: The vault had no address. Twelve of the thirteen surfaces that can save a page told the
//      reader to "find it on the home page" — a navigation instruction in place of a link — and the
//      home page showed four of a possible fifty, three screens down. Every sentence and every
//      route in that answer was written inline in one component, so no other surface could say it.
//      Held here, the home card and the `/vault` route are the same answer rendered twice.
// Info flow: VaultEntry[] + a chosen order -> the list a surface renders; a record id -> the href
//            that reopens it in the studio; counts and a query -> the sentence shown about them.
import { VAULT_CAPACITY, type VaultEntry } from './vault-gallery';

/** The vault's own address. One definition, so a link and a route cannot disagree about it. */
export const VAULT_PATH = '/vault';

/**
 * The query parameter that asks the studio to reopen a saved page.
 *
 * Reopening happens on `/`, because that is where the studio is: restoring a page means putting
 * back a spec, an image, a verdict and a set of Page Controls, and only the studio has those. The
 * vault therefore hands the reader a link rather than trying to rebuild half a studio around a
 * list.
 */
export const VAULT_REOPEN_PARAM = 'creation';

/** Where a row on the vault page sends a reader who wants this page back in the studio. */
export const vaultReopenHref = (id: string): string =>
	`/?${VAULT_REOPEN_PARAM}=${encodeURIComponent(id)}`;

/**
 * What a surface says after a page reaches the vault.
 *
 * Deliberately not "find it on the home page", which is what twelve surfaces said. That sentence
 * was accurate and useless: it named a destination and gave no way to get there, on the twelve
 * screens furthest from it. The link text is separate so the surface can render it as a real link.
 */
export const VAULT_SAVED_CONFIRMATION = 'Saved to the vault.';
export const VAULT_SAVED_LINK_TEXT = 'See all your saved pages';

/**
 * Whether a status line has earned the link to the vault.
 *
 * An exact match against the confirmation, never a substring search for "vault". The same line
 * carries the copy confirmation and every failure the save can produce — and several of those
 * failures say the word "vault" while meaning the page did *not* get there
 * (`'Failed to save to vault.'`, the store's own messages). Offering "see all your saved pages"
 * under one of those sends the reader to look for something that was never written.
 */
export const showsVaultLink = (status: string): boolean =>
	status === VAULT_SAVED_CONFIRMATION;

/** Shown where the vault is empty and the reader has saved nothing yet. */
export const VAULT_EMPTY = 'No saved pages yet. Make one and hit Save to Vault.';

/**
 * Shown when the store could not be read.
 *
 * A failed read leaves the list empty, so without this the storage error would sit directly above
 * "No saved pages yet" — telling the reader their pages do not exist when the truth is the app
 * could not read them.
 */
export const VAULT_UNREADABLE = 'Your saved pages could not be read. They are not gone — see above.';

/** Shown when the vault holds pages but none of them match what was typed. */
export const vaultNoMatches = (query: string): string =>
	`Nothing in the vault matches "${query.trim()}".`;

/**
 * Why a deleted page cannot come back, and what to do instead.
 *
 * Deliberately does not say "delete a page, then undo". Undo holds only the most recent deletion,
 * so following that instruction would discard this record and leave Undo holding the page just
 * deleted to make room for it. Say what is true, and what it costs, instead of scripting a move
 * that destroys the thing the reader is trying to save.
 */
export const vaultFullRefusal = (title: string): string =>
	`The vault is full at ${VAULT_CAPACITY} pages, so "${title}" cannot come back without pushing ` +
	'another page out. It is still held here for now — but Undo only ever holds the most recent ' +
	'deletion, so deleting another page to make room would replace it. Download the page you want ' +
	'to keep before freeing a slot.';

/** How a reader can order the vault. */
export type VaultSortOrder = 'pinned' | 'newest' | 'oldest' | 'title';

export type VaultSortOption = {
	id: VaultSortOrder;
	label: string;
};

/**
 * `pinned` first, because it is what the vault has always done and what a reader who pinned a page
 * expects to see. The rest exist because a vault of fifty pages is a list you search *and* a list
 * you scan, and "the one I made first" is not reachable by searching for it.
 */
export const VAULT_SORT_OPTIONS: readonly VaultSortOption[] = [
	{ id: 'pinned', label: 'Pinned first' },
	{ id: 'newest', label: 'Newest first' },
	{ id: 'oldest', label: 'Oldest first' },
	{ id: 'title', label: 'A to Z' }
];

export const DEFAULT_VAULT_SORT: VaultSortOrder = 'pinned';

/** Narrows an arbitrary string — a select's value, a stored preference — to a real order. */
export const asVaultSortOrder = (value: string): VaultSortOrder =>
	VAULT_SORT_OPTIONS.some((option) => option.id === value)
		? (value as VaultSortOrder)
		: DEFAULT_VAULT_SORT;

const savedAtMs = (entry: VaultEntry): number => {
	const parsed = Date.parse(entry.record.createdAtISO);
	// An unparseable date sorts as the epoch rather than as `NaN`. `NaN` in a comparator makes the
	// whole sort's result implementation-defined — not just that one row's position — so a single
	// corrupt record could scramble the entire list.
	return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Order a set of matched entries.
 *
 * Every order breaks ties on `id`, so the list is total and a re-render cannot shuffle two pages
 * saved in the same millisecond past each other.
 *
 * `pinned` returns the entries untouched: `buildVaultEntries` already produces pinned-first,
 * newest-next, and re-sorting them here would be a second copy of that rule free to disagree with
 * the first.
 */
export const sortVaultEntries = (
	entries: readonly VaultEntry[],
	order: VaultSortOrder
): VaultEntry[] => {
	if (order === 'pinned') return [...entries];
	const byId = (left: VaultEntry, right: VaultEntry): number => left.id.localeCompare(right.id);
	return [...entries].sort((left, right) => {
		if (order === 'title') {
			const byTitle = left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
			return byTitle !== 0 ? byTitle : byId(left, right);
		}
		const difference =
			order === 'newest'
				? savedAtMs(right) - savedAtMs(left)
				: savedAtMs(left) - savedAtMs(right);
		return difference !== 0 ? difference : byId(left, right);
	});
};

/**
 * The count a vault surface shows about itself.
 *
 * Two numbers, kept apart on purpose: how many pages are in the vault, and how many the current
 * search is showing. Collapsing them is how a search comes to look like a vault that lost pages.
 */
export const describeVaultCount = (total: number, matching: number, query: string): string => {
	if (total === 0) return '';
	const saved = `${total} saved`;
	if (query.trim().length === 0 || matching === total) return saved;
	return `${matching} of ${saved}`;
};
