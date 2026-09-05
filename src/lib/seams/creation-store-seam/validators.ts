// Purpose: Validate CreationStoreSeam records and drafts against the contract schemas.
// Why: The adapter and the mock both parse stored JSON, and a browser's localStorage is the one
//      input this seam cannot type-check at the boundary — a record written by an older build, or
//      edited by hand, arrives as `unknown`.
// Info flow: stored JSON -> validators -> typed record, or a reported/thrown failure.
//
// Re-exported from `contract.ts` rather than restated: a second copy of these shapes is a second
// thing to keep in step, and the contract is where the seam's schemas are declared.
//
// This module is the seam's only parse of stored JSON. It was added as the artifact
// `src/lib/seams/AGENTS.md` requires and then imported by nothing, while the adapter went on
// calling `safeParse` at four sites of its own — the required artifact present as dead code, and
// the duplicate parsing paths it exists to remove still there. A review caught that; the adapter
// now routes through here.
import { CreationRecordSchema, DraftRecordSchema, StyleSelectionSchema } from './contract';
import type { CreationRecord, DraftRecord, StoredStyleSelection } from './contract';

export { CreationRecordSchema, DraftRecordSchema, StyleSelectionSchema };

/**
 * A parse that reports rather than throws, and carries the parsed value when it succeeds.
 *
 * Deliberately not the shared `Result` type: every call site phrases its own failure — the vault
 * read skips a bad record and counts it, `getDraft` returns `DRAFT_SCHEMA_MISMATCH`, `saveCreation`
 * returns `CREATION_SCHEMA_MISMATCH` — so a message carried up from here would only be discarded.
 * And deliberately not a bare boolean, which was the first shape of this and could not carry the
 * parsed record the adapter actually needs, which is why nothing could use it.
 */
export type ParseOutcome<T> = { ok: true; value: T } | { ok: false };

/**
 * Non-throwing parses, for the paths that must survive bad input rather than crash on it.
 *
 * The production adapter reads every creation out of `localStorage` and skips the entries that do
 * not parse, keeping the rest — a single corrupt record must not empty a reader's vault. That
 * behaviour needs a validator that reports rather than throws, and needs the parsed record back.
 */
export const parseCreationRecord = (input: unknown): ParseOutcome<CreationRecord> => {
	const parsed = CreationRecordSchema.safeParse(input);
	return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
};

export const parseDraftRecord = (input: unknown): ParseOutcome<DraftRecord> => {
	const parsed = DraftRecordSchema.safeParse(input);
	return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
};

/** Throws on an invalid record. Use where a failure is a programming error. */
export const validateCreationRecord = (input: unknown): CreationRecord =>
	CreationRecordSchema.parse(input);

export const validateDraftRecord = (input: unknown): DraftRecord => DraftRecordSchema.parse(input);

/**
 * The page's stored look — theme, voice, glitter, and the wig the `Vibe:` line named.
 *
 * Optional on both records, so this validates the value when one is present; absence is a record
 * written before the field existed and is not an error.
 */
export const validateStyleSelection = (input: unknown): StoredStyleSelection =>
	StyleSelectionSchema.parse(input);
