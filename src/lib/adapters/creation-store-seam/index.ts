/*
 * Purpose: Canonical CreationStoreSeam adapter implementation.
 * Why: Persist creations and drafts in browser storage without hidden I/O.
 * Info flow: Records -> localStorage -> parse (valid records + skipped indices) -> retrieval by owner/id.
 * Invariants:
 *   - A save NEVER removes a page the reader already saved. This file used to keep the newest 50
 *     records and silently drop the rest, then report success; the capacity decision now lives in
 *     `planCreationWrite` and a save that cannot fit is refused with a sentence naming the remedy.
 *   - A quota failure is reported as its own thing. It is the limit a reader actually reaches — a
 *     real provider image is a quarter of a megabyte of base64 — and it is the one storage failure
 *     with a remedy, so it must not be collapsed into the generic write error.
 *   - Corrupted entries are skipped with indices tracked; operations require a browser environment.
 */
// The seam's own validators, rather than its schemas re-parsed here. Four `safeParse` calls used to
// live in this file, which left `validators.ts` — an artifact `src/lib/seams/AGENTS.md` requires —
// imported by nothing while the duplicate parsing it exists to remove stayed put.
import {
	parseCreationRecord,
	parseDraftRecord,
	validateDraftRecord
} from '../../seams/creation-store-seam/validators';
// The capacity rule and its sentences are pure, so they live in core where they are unit-tested
// against the real record shapes rather than against localStorage. This adapter decides no
// capacity of its own: it loads, asks, and writes what it is told — the same arrangement
// `output-packaging-seam` has with `print-layout`.
import {
	VAULT_DEVICE_FULL_REFUSAL,
	isStorageFullError,
	ownerMatches,
	planCreationWrite
} from '../../core/vault-capacity';
import type {
	CreationRecord,
	CreationStoreSeam,
	DraftRecord,
	SaveCreationInput,
	SaveDraftInput
} from '../../seams/creation-store-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

const CREATIONS_KEY = 'cb_creations_v1';
const DRAFT_KEY = 'cb_drafts_v1';

/** The failure code each capacity refusal is reported under. */
const REFUSAL_CODES = {
	RECORD_CAP: 'VAULT_FULL',
	ID_COLLISION: 'VAULT_ID_COLLISION'
} as const;

const browserGuard = <T>(message: string): Result<T> => ({
	ok: false,
	error: {
		code: 'BROWSER_REQUIRED',
		message
	}
});

const readJson = (key: string): Result<unknown | null> => {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) {
			return { ok: true, value: null };
		}
		return { ok: true, value: JSON.parse(raw) };
	} catch {
		return {
			ok: false,
			error: {
				code: 'STORAGE_PARSE_FAILED',
				message: `Failed to parse storage for ${key}.`
			}
		};
	}
};

/**
 * Write one key, telling "this device is out of room" apart from every other failure.
 *
 * `fullMessage` is what the caller wants said when the browser refuses for space, because the
 * remedy differs by key: a creation the reader can free room for by deleting a saved page, a draft
 * they cannot act on at all. The generic branch keeps the message it always had — it covers a
 * `SecurityError` from a browser with site data blocked, where nothing the reader deletes helps.
 *
 * `setItem` either stores the whole serialised value or throws, so on either failure branch the
 * previously stored value is still there, untouched. That is what lets the refusals above promise
 * that nothing already saved was lost.
 */
const writeJson = (
	key: string,
	value: unknown,
	fullMessage?: string
): Result<boolean> => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return { ok: true, value: true };
	} catch (writeError) {
		if (fullMessage && isStorageFullError(writeError)) {
			return {
				ok: false,
				error: { code: 'STORAGE_FULL', message: fullMessage }
			};
		}
		return {
			ok: false,
			error: {
				code: 'STORAGE_WRITE_FAILED',
				message: `Failed to write storage for ${key}.`
			}
		};
	}
};

// Parsed creations plus the positions of entries dropped by schema validation.
// skippedIndices carries both the count (its length) and the identity (stored
// position) of every dropped entry, without carrying the entry contents.
export type ParsedRecords = {
	records: CreationRecord[];
	skippedIndices: number[];
};

export const parseRecords = (value: unknown): Result<ParsedRecords> => {
	if (value === null) {
		return { ok: true, value: { records: [], skippedIndices: [] } };
	}
	if (!Array.isArray(value)) {
		return {
			ok: false,
			error: {
				code: 'STORAGE_SCHEMA_MISMATCH',
				message: 'Stored creations are not an array.'
			}
		};
	}
	const records: CreationRecord[] = [];
	const skippedIndices: number[] = [];
	for (const [index, record] of value.entries()) {
		const parsed = parseCreationRecord(record);
		if (!parsed.ok) {
			skippedIndices.push(index);
			continue;
		}
		records.push(parsed.value);
	}
	if (skippedIndices.length > 0) {
		console.warn(
			`[CreationStore] Skipped ${skippedIndices.length} malformed creation record(s) at indices: ${skippedIndices.join(', ')}`
		);
	}
	return { ok: true, value: { records, skippedIndices } };
};

const loadRecords = (): Result<ParsedRecords> => {
	const raw = readJson(CREATIONS_KEY);
	if (!raw.ok) {
		return raw;
	}
	return parseRecords(raw.value);
};

/**
 * Persist the creations array.
 *
 * A save is the one write where running out of room has a remedy the reader can act on, so it is
 * the one that passes a message saying so. `deleteCreation` writes a strictly smaller array and so
 * cannot be the write that fills the store.
 */
const saveRecords = (records: CreationRecord[]): Result<boolean> =>
	writeJson(CREATIONS_KEY, records, VAULT_DEVICE_FULL_REFUSAL);

const parseDraft = (value: unknown | null): Result<DraftRecord | null> => {
	if (value === null) {
		return { ok: true, value: null };
	}
	const parsed = parseDraftRecord(value);
	if (!parsed.ok) {
		return {
			ok: false,
			error: {
				code: 'DRAFT_SCHEMA_MISMATCH',
				message: 'Stored draft failed schema validation.'
			}
		};
	}
	return { ok: true, value: parsed.value };
};

export const creationStoreAdapter: CreationStoreSeam = {
	saveCreation: async (input: SaveCreationInput) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const parsedRecord = parseCreationRecord(input.record);
		if (!parsedRecord.ok) {
			return {
				ok: false,
				error: {
					code: 'CREATION_SCHEMA_MISMATCH',
					message: 'Creation record failed schema validation.'
				}
			};
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		// The capacity question is asked before the write, and answered by refusing rather than by
		// evicting. What this replaced — `[record, ...filtered].slice(0, MAX_CREATIONS)` — deleted
		// the reader's oldest saved page and then returned `ok`, so every surface in the app
		// reported "Saved to the vault." for a save that had destroyed one.
		const plan = planCreationWrite(existing.value.records, parsedRecord.value);
		if (!plan.ok) {
			// Each reason gets its own code rather than being flattened to one: a full vault is
			// cleared by deleting a page and an id collision by pressing Save again, and a caller
			// that cannot tell them apart cannot offer either.
			return {
				ok: false,
				error: { code: REFUSAL_CODES[plan.reason], message: plan.message }
			};
		}
		const stored = saveRecords(plan.records);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: parsedRecord.value };
	},
	listCreations: async (input) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		const filtered = existing.value.records.filter((record) =>
			ownerMatches(record, input.owner)
		);
		return { ok: true, value: filtered };
	},
	getCreation: async (input) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		const found =
			existing.value.records.find((record) => record.id === input.id) || null;
		return { ok: true, value: found };
	},
	deleteCreation: async (input) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		const beforeCount = existing.value.records.length;
		const filtered = existing.value.records.filter(
			(record) => record.id !== input.id
		);
		// Not `saveRecords`: this array is strictly smaller than the one already stored, so it cannot
		// be the write that fills the device, and telling a reader who is deleting a page to delete
		// a page would be the one useless thing to say here.
		const stored = writeJson(CREATIONS_KEY, filtered);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: filtered.length < beforeCount };
	},
	saveDraft: async (input: SaveDraftInput) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const draft = validateDraftRecord(input.draft);
		const stored = writeJson(DRAFT_KEY, draft);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: draft };
	},
	getDraft: async () => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const raw = readJson(DRAFT_KEY);
		if (!raw.ok) {
			return raw;
		}
		return parseDraft(raw.value);
	},
	clearDraft: async () => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const stored = writeJson(DRAFT_KEY, null);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: true };
	}
};
