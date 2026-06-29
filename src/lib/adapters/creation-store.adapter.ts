// Purpose: Adapter implementation for CreationStoreSeam.
// Why: Persist creations and drafts in browser storage without hidden I/O.
// Info flow: Records -> localStorage -> retrieval by owner/id.
import {
	CreationRecordSchema,
	DraftRecordSchema
} from '../../../contracts/creation-store.contract';
import type {
	CreationRecord,
	CreationStoreSeam,
	DraftRecord,
	SaveCreationInput,
	SaveDraftInput
} from '../../../contracts/creation-store.contract';
import type { Result } from '../../../contracts/shared.contract';
import { MAX_TITLE_LENGTH, MAX_FREE_TEXT_LENGTH } from '../core/constants';
import { MAX_LABEL_LENGTH as MAX_STUDIO_LABEL_LENGTH } from '../../../contracts/meechie-studio-text.contract';

const CREATIONS_KEY = 'cb_creations_v1';
const DRAFT_KEY = 'cb_drafts_v1';
const MAX_CREATIONS = 50;

// MAX_TITLE_LENGTH was tightened from 96 to 80 after some users had already saved
// creations/drafts with longer titles; clamp those legacy titles on load so the
// schema-mismatch doesn't take down the whole vault/draft read for old data that
// was valid when it was written. New writes go through compactColoringPageTitle,
// which already enforces the current cap, so this only matters for old records.
const clampLegacyTitle = (record: unknown): unknown => {
	if (!record || typeof record !== 'object' || !('intent' in record)) {
		return record;
	}
	const intent = (record as { intent: unknown }).intent;
	if (!intent || typeof intent !== 'object' || !('title' in intent)) {
		return record;
	}
	const title = (intent as { title: unknown }).title;
	if (typeof title !== 'string') {
		return record;
	}
	const trimmedTitle = title.trim();
	if (trimmedTitle.length === 0) {
		// All-whitespace title: trimming to '' would fail NonEmptyStringSchema's
		// min(1) and break the whole vault/draft read. Keep the original
		// whitespace (clamped to the cap) instead, since it was valid when written.
		if (title.length <= MAX_TITLE_LENGTH) {
			return record;
		}
		return {
			...record,
			intent: { ...intent, title: title.slice(0, MAX_TITLE_LENGTH) }
		};
	}
	if (trimmedTitle.length <= MAX_TITLE_LENGTH) {
		if (trimmedTitle === title) {
			return record;
		}
		return {
			...record,
			intent: { ...intent, title: trimmedTitle }
		};
	}
	return {
		...record,
		intent: { ...intent, title: trimmedTitle.slice(0, MAX_TITLE_LENGTH).trim() }
	};
};

// Shared by clampLegacyStudioText below for each over-cap string field it clamps.
const clampLegacyText = (value: string, maxLength: number): string => {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		// All-whitespace value: trimming to '' would fail NonEmptyStringSchema's min(1).
		return value.length <= maxLength ? value : value.slice(0, maxLength);
	}
	if (trimmed.length <= maxLength) {
		return trimmed;
	}
	return trimmed.slice(0, maxLength).trim();
};

// MeechieStudioTextOutputSchema's verdict/quote/pageTitle/pageItems[].label caps were added
// after some users had already saved creations/drafts with longer studioText fields; clamp
// those legacy values on load for the same reason clampLegacyTitle exists above — old data
// was valid when it was written.
const clampLegacyStudioText = (record: unknown): unknown => {
	if (!record || typeof record !== 'object' || !('studioText' in record)) {
		return record;
	}
	const studioText = (record as { studioText: unknown }).studioText;
	if (!studioText || typeof studioText !== 'object') {
		return record;
	}
	const { verdict, quote, pageTitle, pageItems } = studioText as {
		verdict?: unknown;
		quote?: unknown;
		pageTitle?: unknown;
		pageItems?: unknown;
	};
	const clampedPageItems = Array.isArray(pageItems)
		? pageItems.map((item) =>
				item && typeof item === 'object' && typeof (item as { label?: unknown }).label === 'string'
					? {
							...item,
							label: clampLegacyText((item as { label: string }).label, MAX_STUDIO_LABEL_LENGTH)
						}
					: item
			)
		: pageItems;
	return {
		...record,
		studioText: {
			...studioText,
			...(typeof verdict === 'string'
				? { verdict: clampLegacyText(verdict, MAX_FREE_TEXT_LENGTH) }
				: {}),
			...(typeof quote === 'string' ? { quote: clampLegacyText(quote, MAX_FREE_TEXT_LENGTH) } : {}),
			...(typeof pageTitle === 'string'
				? { pageTitle: clampLegacyText(pageTitle, MAX_STUDIO_LABEL_LENGTH) }
				: {}),
			...(pageItems !== undefined ? { pageItems: clampedPageItems } : {})
		}
	};
};

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

const writeJson = (key: string, value: unknown): Result<boolean> => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return { ok: true, value: true };
	} catch {
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
		const parsed = CreationRecordSchema.safeParse(
			clampLegacyStudioText(clampLegacyTitle(record))
		);
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

const ownerMatches = (
	record: CreationRecord,
	owner: CreationRecord['owner']
): boolean => {
	if (record.owner.kind === 'anonymous' && owner.kind === 'anonymous') {
		return record.owner.sessionId === owner.sessionId;
	}
	if (record.owner.kind === 'authenticated' && owner.kind === 'authenticated') {
		return record.owner.userId === owner.userId;
	}
	return false;
};

const upsertRecord = (
	records: CreationRecord[],
	record: CreationRecord
): CreationRecord[] => {
	const filtered = records.filter((existing) => existing.id !== record.id);
	const next = [record, ...filtered];
	return next.slice(0, MAX_CREATIONS);
};

const parseDraft = (value: unknown | null): Result<DraftRecord | null> => {
	if (value === null) {
		return { ok: true, value: null };
	}
	const parsed = DraftRecordSchema.safeParse(clampLegacyStudioText(clampLegacyTitle(value)));
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
		const parsedRecord = CreationRecordSchema.safeParse(input.record);
		if (!parsedRecord.success) {
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
		const updated = upsertRecord(existing.value, parsedRecord.data);
		const stored = saveRecords(updated);
		if (!stored.ok) {
			return stored;
		}
		return { ok: true, value: parsedRecord.data };
	},
	listCreations: async (input) => {
		if (typeof localStorage === 'undefined') {
			return browserGuard('Creation store requires a browser environment.');
		}
		const existing = loadRecords();
		if (!existing.ok) {
			return existing;
		}
		const filtered = existing.value.filter((record) =>
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
			existing.value.find((record) => record.id === input.id) || null;
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
