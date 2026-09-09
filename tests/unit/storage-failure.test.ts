/*
 * Purpose: Prove that no storage failure ever puts a developer's string on a reader's screen, and
 *          that the retry is offered exactly where pressing it could land differently.
 * Why: These are the two claims `src/lib/core/storage-failure.ts` exists to make, and both are the
 *      kind that decay silently — a new adapter code lands in the `unknown` default and starts
 *      offering a retry against a condition that cannot change, or a reworded refusal stops matching
 *      `vaultLinkFor` and quietly drops the "Make room in the vault" link.
 * Info flow: adapter source + seam errors + thrown values -> classifyStorageFailure -> assertions on
 *            the reader's sentence, the retry, and where the raw words ended up.
 * Invariants: The allowlisted refusals are asserted with `toBe` against the constants themselves,
 *             never against a copied literal — a test holding its own copy of the sentence would
 *             pass while the app and the link decision disagreed.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	authoredStorageRefusal,
	classifyStorageFailure,
	storageRetryLabel,
	type StorageOperation
} from '../../src/lib/core/storage-failure';
import {
	VAULT_DEVICE_FULL_REFUSAL,
	VAULT_ID_COLLISION_REFUSAL,
	VAULT_RECORD_CAP_REFUSAL
} from '../../src/lib/core/vault-capacity';
import { vaultLinkFor } from '../../src/lib/core/vault-page';

const OPERATIONS: StorageOperation[] = [
	'read',
	'save',
	'delete',
	'restore',
	'pin',
	'unpin',
	'draft'
];

/** Every code the adapter can actually emit, read from the adapter rather than transcribed. */
const adapterCodes = (): string[] => {
	const source = readFileSync('src/lib/adapters/creation-store-seam/index.ts', 'utf8');
	return [...new Set([...source.matchAll(/code: '([A-Z_]+)'/g)].map((match) => match[1]))];
};

describe('classifyStorageFailure', () => {
	// The load-bearing test of the whole module. Two call sites used to write a caught exception's
	// own message onto the screen, which is what `generation-failure.ts` forbids for AI calls and
	// what storage went on doing.
	it('never lets an exception speak to the reader', () => {
		const thrown = new Error('SecurityError: localStorage getItem blocked at chunk-4f2.js:118');

		for (const operation of OPERATIONS) {
			const failure = classifyStorageFailure(operation, thrown);
			expect(failure.message).not.toContain('SecurityError');
			expect(failure.message).not.toContain('chunk-4f2.js');
			expect(failure.detail).toBe(thrown.message);
		}
	});

	// An `Error` can carry a `code` — Node sets one on system errors — and would then be read as a
	// seam refusal, whose message goes on screen through the allowlist branch. That is the single
	// hole through which an exception's words could reach a reader.
	it('does not mistake an Error carrying a code for a seam refusal', () => {
		const thrown = Object.assign(new Error('ENOENT: no such file or directory'), {
			code: 'STORAGE_WRITE_FAILED'
		});

		const failure = classifyStorageFailure('save', thrown);

		expect(failure.message).not.toContain('ENOENT');
		expect(failure.detail).toBe('ENOENT: no such file or directory');
	});

	it('never lets the seam speak to the reader either', () => {
		// The adapter's real sentence for a damaged store, named once so the three assertions below
		// cannot drift into testing three slightly different strings.
		const seamMessage = 'Stored creations are not an array.';
		const failure = classifyStorageFailure('read', {
			code: 'STORAGE_SCHEMA_MISMATCH',
			message: seamMessage
		});

		expect(failure.message).not.toContain(seamMessage);
		expect(failure.detail).toBe(seamMessage);
		expect(failure.cause).toBe('unreadable');
	});

	// Verbatim is not a preference. `vaultLinkFor` matches these character-for-character to decide
	// whether the status line carries "Make room in the vault", so rewording one silently removes
	// the link on the two failures where the reader needs it most.
	it.each([
		['the record cap', VAULT_RECORD_CAP_REFUSAL, 'VAULT_FULL', 'vault_full'],
		['a full device', VAULT_DEVICE_FULL_REFUSAL, 'STORAGE_FULL', 'device_full'],
		['an id collision', VAULT_ID_COLLISION_REFUSAL, 'VAULT_ID_COLLISION', 'id_collision']
	])('returns the refusal this app wrote for %s unchanged', (_name, message, code, cause) => {
		const failure = classifyStorageFailure('save', { code, message });

		expect(failure.message).toBe(message);
		expect(failure.cause).toBe(cause);
		expect(failure.retry).toEqual({ kind: 'none' });
		expect(failure.detail).toBeNull();
	});

	it('keeps the make-room link working through the classifier', () => {
		const failure = classifyStorageFailure('save', {
			code: 'STORAGE_FULL',
			message: VAULT_DEVICE_FULL_REFUSAL
		});

		expect(vaultLinkFor(failure.message)).not.toBeNull();
	});

	// A new failure mode landing in `unknown` would be offered a retry, because that is the branch
	// that offers one. Reading the adapter rather than a transcribed list is what makes this fail
	// when the adapter grows a code instead of when someone remembers to update a test.
	it('names every code the adapter can emit', () => {
		const unmapped = adapterCodes().filter(
			(code) => classifyStorageFailure('save', { code, message: 'x' }).cause === 'unknown'
		);

		expect(unmapped).toEqual([]);
	});

	it.each([
		['a record the store refuses for its own shape', 'CREATION_SCHEMA_MISMATCH', 'rejected'],
		['a vault at its page cap', 'VAULT_FULL', 'vault_full'],
		['a device out of room', 'STORAGE_FULL', 'device_full']
	])('offers no retry for %s', (_name, code, cause) => {
		const failure = classifyStorageFailure('save', { code, message: 'diagnostic' });

		expect(failure.cause).toBe(cause);
		expect(failure.retry).toEqual({ kind: 'none' });
		expect(storageRetryLabel(failure, 'save')).toBeNull();
	});

	// `readJson` wraps `localStorage.getItem` and `JSON.parse` in ONE try/catch and reports both as
	// STORAGE_PARSE_FAILED, so this cause cannot know which it is. The first version of this message
	// said only "the stored data is damaged, clear your site data" — destructive advice, given on a
	// guess, to a reader whose saved pages were fine.
	it('never tells a reader to clear their data without first naming the harmless cause', () => {
		const failure = classifyStorageFailure('read', {
			code: 'STORAGE_PARSE_FAILED',
			message: 'Failed to parse storage for cb_creations_v1.'
		});

		expect(failure.cause).toBe('unreadable');
		// Both causes named...
		expect(failure.message).toContain('blocking site data');
		expect(failure.message).toContain('is damaged');
		// The subject already says "could not be read"; the remedy must not repeat it back.
		expect(failure.message).not.toContain('or because what is stored here cannot be read');
		// ...with the harmless check offered before the destructive remedy, and the destructive one
		// made conditional on it.
		const checkAt = failure.message.indexOf('Check the site-data setting');
		const clearAt = failure.message.indexOf("clearing this site's stored data");
		expect(checkAt).toBeGreaterThan(-1);
		expect(clearAt).toBeGreaterThan(checkAt);
		expect(failure.message).toContain('If it is already allowed');
		// And a retry, because one of the two causes is a setting the reader can change, and
		// pressing the button is how they find out it took.
		expect(failure.retry).toEqual({ kind: 'now' });
	});

	// `writeJson`'s generic branch reports STORAGE_WRITE_FAILED, and its own comment says that
	// branch covers a SecurityError from a browser with site data blocked. Promising only that the
	// retry is free would leave that reader pressing a button that fails identically forever.
	it('names the blocked-browser remedy on a failed write, not just the free retry', () => {
		const failure = classifyStorageFailure('save', {
			code: 'STORAGE_WRITE_FAILED',
			message: 'Failed to write storage for cb_creations_v1.'
		});

		expect(failure.message).toContain('costs nothing');
		expect(failure.message).toContain('allows site data');
		expect(failure.retry).toEqual({ kind: 'now' });
	});

	// A remedy the surface cannot perform is the same defect as no remedy at all. There is no draft
	// export anywhere in the app, so the draft failure must not say "download it".
	it('never tells a draft failure to download something that cannot be downloaded', () => {
		const draft = classifyStorageFailure('draft', {
			code: 'STORAGE_WRITE_FAILED',
			message: 'x'
		});

		expect(draft.message).not.toContain('Download it');
		expect(draft.message).toContain('copy anything you cannot retype');
	});

	// One `toggleFavorite` serves both directions. Reporting either as `pin` told a reader who
	// pressed Unpin that the page "could not be pinned", under a button that would unpin it.
	it('tells a failed unpin apart from a failed pin, in both the sentence and the button', () => {
		const failure = classifyStorageFailure('unpin', {
			code: 'STORAGE_WRITE_FAILED',
			message: 'x'
		});

		expect(failure.message).toContain('could not be unpinned');
		expect(storageRetryLabel(failure, 'unpin')).toBe('Try unpinning again');
		expect(storageRetryLabel(failure, 'pin')).toBe('Try pinning again');
	});

	// The reason the retry exists at all: a local write that missed can land on the next press, and
	// unlike every AI retry in this app it spends no quota.
	it.each([
		['a write that missed', 'STORAGE_WRITE_FAILED'],
		['a code this app does not know', 'SOMETHING_NEW']
	])('offers a free retry for %s', (_name, code) => {
		const failure = classifyStorageFailure('save', { code, message: 'diagnostic' });

		expect(failure.retry).toEqual({ kind: 'now' });
		expect(failure.message).toContain('costs nothing');
		expect(storageRetryLabel(failure, 'save')).toBe('Save it again');
	});

	// One sentence covering both would have to be vague enough to be useless: a failed read
	// threatens nothing the reader is holding, a failed save threatens the page on screen.
	it('names what was being attempted, and warns only where work is at risk', () => {
		const read = classifyStorageFailure('read', { code: 'BROWSER_REQUIRED', message: 'x' });
		const save = classifyStorageFailure('save', { code: 'BROWSER_REQUIRED', message: 'x' });

		expect(read.message).toContain('Your saved pages could not be read.');
		expect(read.message).not.toContain('Download it to keep it');
		expect(save.message).toContain('could not be saved to the vault');
		expect(save.message).toContain('Download it to keep it');
	});

	// A row of identical "Try again" buttons on the vault page says nothing about which page each
	// one would act on.
	it('gives every operation its own retry wording', () => {
		const failure = classifyStorageFailure('save', {
			code: 'STORAGE_WRITE_FAILED',
			message: 'x'
		});
		const labels = OPERATIONS.map((operation) => storageRetryLabel(failure, operation));

		expect(new Set(labels).size).toBe(OPERATIONS.length);
		expect(labels).not.toContain(null);
	});

	it('treats a thrown non-Error as having nothing to record', () => {
		const failure = classifyStorageFailure('draft', undefined);

		expect(failure.cause).toBe('unknown');
		expect(failure.detail).toBeNull();
		expect(failure.message).toContain('Your work in progress could not be saved');
	});

	// The one branch that keeps its own sentence, because it knows something the classifier cannot:
	// the page being refused is the one Undo is still holding and about to lose.
	it('wraps a sentence the call site wrote without adding a retry to it', () => {
		const failure = authoredStorageRefusal('Undo cannot put it back: the vault is full.');

		expect(failure.message).toBe('Undo cannot put it back: the vault is full.');
		expect(failure.retry).toEqual({ kind: 'none' });
		expect(failure.detail).toBeNull();
	});
});
