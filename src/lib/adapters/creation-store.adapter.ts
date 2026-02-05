// Purpose: Adapter implementation for CreationStoreSeam.
// Why: Persist creations and drafts in browser storage without hidden I/O.
// Info flow: Records -> localStorage -> retrieval by owner/id.
import { CreationRecordSchema, DraftRecordSchema } from '../../../contracts/creation-store.contract';
import type {
	CreationRecord,
	CreationStoreSeam,
	DraftRecord,
	SaveCreationInput,
	SaveDraftInput
} from '../../../contracts/creation-store.contract';
import type { Result } from '../../../contracts/shared.contract';

const CREATIONS_KEY = 'cb_creations_v1';
const DRAFT_KEY = 'cb_drafts_v1';
const MAX_CREATIONS = 50;

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
	} catch (error) {
		return {
			ok: false,
			error: {
				code: 'STORAGE_PARSE_FAILED',
				message: `Failed to parse storage for ${key}.`
			}
		};
	}
};

const writeJson = (key: string, value: unknown): Result<boolean> => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return { ok: true, value: true };
	} catch (error) {
		return {
			ok: false,
			error: {
				code: 'STORAGE_WRITE_FAILED',
				message: `Failed to write storage for ${key}.`
			}
		};
	}
};

const parseRecords = (value: unknown): Result<CreationRecord[]> => {
	if (value === null) {
		return { ok: true, value: [] };
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
	for (const record of value) {
		const parsed = CreationRecordSchema.safeParse(record);
		if (!parsed.success) {
			return {
				ok: false,
				error: {
					code: 'STORAGE_SCHEMA_MISMATCH',
					message: 'Stored creation record failed schema validation.'
				}
			};
		}
		records.push(parsed.data);
	}
	return { ok: true, value: records };
};

const loadRecords = (): Result<CreationRecord[]> => {
	const raw = readJson(CREATIONS_KEY);
	if (!raw.ok) {
		return raw;
	}
	return parseRecords(raw.value);
};

const saveRecords = (records: CreationRecord[]): Result<boolean> =>
	writeJson(CREATIONS_KEY, records);

const ownerMatches = (record: CreationRecord, owner: CreationRecord['owner']): boolean => {
	if (record.owner.kind === 'anonymous' && owner.kind === 'anonymous') {
		return record.owner.sessionId === owner.sessionId;
	}
	if (record.owner.kind === 'authenticated' && owner.kind === 'authenticated') {
		return record.owner.userId === owner.userId;
	}
	return false;
};

const upsertRecord = (records: CreationRecord[], record: CreationRecord): CreationRecord[] => {
	const filtered = records.filter((existing) => existing.id !== record.id);
	const next = [record, ...filtered];
	return next.slice(0, MAX_CREATIONS);
};

const parseDraft = (value: unknown | null): Result<DraftRecord | null> => {
	if (value === null) {
		return { ok: true, value: null };
	}
	const parsed = DraftRecordSchema.safeParse(value);
	if (!parsed.success) {
		return {
			ok: false,
			error: {
				code: 'DRAFT_SCHEMA_MISMATCH',
				message: 'Stored draft failed schema validation.'
			}
		};
	}
	return { ok: true, value: parsed.data };
};

export const creationStoreAdapter: CreationStoreSeam = {
	saveCreation: async (input: SaveCreationInput) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		const updated = upsertRecord(existing.value, input.record);
		const stored = saveRecords(updated);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: input.record };
	},
	listCreations: async (input) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		const filtered = existing.value.filter((record) => ownerMatches(record, input.owner));
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
		const found = existing.value.find((record) => record.id === input.id) || null;
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
		const beforeCount = existing.value.length;
		const filtered = existing.value.filter((record) => record.id !== input.id);
		const stored = saveRecords(filtered);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: filtered.length < beforeCount };
	},
	saveDraft: async (input: SaveDraftInput) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const draft = DraftRecordSchema.parse(input.draft);
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
