// Purpose: Validate CreationStoreSeam records and drafts against the contract schemas.
// Why: The adapter and the mock both parse stored JSON, and a browser's localStorage is the one
//      input this seam cannot type-check at the boundary — a record written by an older build, or
//      edited by hand, arrives as `unknown`.
// Info flow: stored JSON -> validators -> typed record, or a thrown/`safeParse` failure.
//
// Re-exported from `contract.ts` rather than restated: a second copy of these shapes is a second
// thing to keep in step, and the contract is where the seam's schemas are declared.
import {
	CreationRecordSchema,
	DraftRecordSchema,
	StyleSelectionSchema
} from './contract';
import type { CreationRecord, DraftRecord, StoredStyleSelection } from './contract';

export { CreationRecordSchema, DraftRecordSchema, StyleSelectionSchema };

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

/**
 * Non-throwing variants, for the paths that must survive bad input rather than crash on it.
 *
 * The production adapter reads every creation out of `localStorage` and skips the entries that do
 * not parse, keeping the rest — a single corrupt record must not empty a reader's vault. That
 * behaviour needs a validator that reports rather than throws.
 */
export const isCreationRecord = (input: unknown): boolean =>
	CreationRecordSchema.safeParse(input).success;

export const isDraftRecord = (input: unknown): boolean =>
	DraftRecordSchema.safeParse(input).success;
