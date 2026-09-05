/*
 * Purpose: Define the canonical CreationStoreSeam contract and schemas.
 * Why: Provide stable storage and retrieval contracts for creations and drafts.
 * Info flow: Creation data -> CreationStoreSeam -> persistent storage.
 * Invariants: Maximum 50 creations stored; images must have b64 or url; owner must have valid identity.
 */
import { z } from 'zod';
import { AuthContextSchema } from '../auth-context-seam/contract';
import { ColoringPageSpecSchema } from '../spec-validation-seam/contract';
import { MeechieStudioTextOutputSchema } from '../../../../contracts/meechie-studio-text.contract';
import { MeechieStudioVoiceSettingsSchema } from '../meechie-studio-text-seam/contract';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';
import { ViolationSchema } from '../drift-detection-seam/contract';

export const MAX_CREATIONS = 50;

/**
 * The Page Controls choices that compose a page's `Vibe:` line.
 *
 * `intent` (a `ColoringPageSpec`) already carries page size and border, so reopening a page brought
 * those back. It carries no theme, voice or glitter — those reach the page only through the style
 * hint, which is assembled at request time and never stored. So a reopened page displayed the
 * *defaults* in its Page Controls, and the next control the reader touched re-encoded those
 * defaults over the choices that actually made the page.
 *
 * Optional, and unversioned on purpose: every record written before this field existed stays valid
 * and parses unchanged, and the studio treats its absence as "this page's style is not on file"
 * rather than as the defaults.
 *
 * The voice schema is reused rather than restated — it is the same value the studio sends to
 * `MeechieStudioTextSeam`, and a second copy of three enums is a second thing to keep in step.
 */
export const StyleSelectionSchema = z.object({
	themeId: NonEmptyStringSchema,
	voice: MeechieStudioVoiceSettingsSchema,
	glitter: z.boolean(),
	// Only what the hint prints. The catalog id is deliberately not stored: it would look like a
	// reference the try-on studio should honour on restore, and reproducing a `Vibe:` line needs
	// the two printed strings, not a wig the reader has not re-selected.
	wig: z
		.object({
			name: NonEmptyStringSchema,
			style: NonEmptyStringSchema
		})
		.optional()
});

export const CreationOwnerSchema = z.union([
	z.object({
		kind: z.literal('anonymous'),
		sessionId: NonEmptyStringSchema
	}),
	z.object({
		kind: z.literal('authenticated'),
		userId: NonEmptyStringSchema
	})
]);

export const CreationImageSchema = z
	.object({
		b64: NonEmptyStringSchema.optional(),
		url: NonEmptyStringSchema.optional()
	})
	.refine((value) => !!value.b64 || !!value.url, {
		message: 'image must include b64 or url'
	});

export const CreationRecordSchema = z.object({
	id: NonEmptyStringSchema,
	createdAtISO: NonEmptyStringSchema,
	intent: ColoringPageSpecSchema,
	assembledPrompt: NonEmptyStringSchema,
	studioText: MeechieStudioTextOutputSchema.optional(),
	revisedPrompt: NonEmptyStringSchema.optional(),
	images: z.array(CreationImageSchema).optional(),
	favorite: z.boolean().optional(),
	violations: z.array(ViolationSchema).optional(),
	fixesApplied: z.array(NonEmptyStringSchema).optional(),
	authContext: AuthContextSchema.optional(),
	styleSelection: StyleSelectionSchema.optional(),
	owner: CreationOwnerSchema
});

export const DraftRecordSchema = z.object({
	updatedAtISO: NonEmptyStringSchema,
	intent: ColoringPageSpecSchema,
	chatMessage: NonEmptyStringSchema.optional(),
	studioText: MeechieStudioTextOutputSchema.optional(),
	styleSelection: StyleSelectionSchema.optional()
});

export const SaveCreationInputSchema = z.object({
	record: CreationRecordSchema
});

export const ListCreationsInputSchema = z.object({
	owner: CreationOwnerSchema
});

export const GetCreationInputSchema = z.object({
	id: NonEmptyStringSchema
});

export const DeleteCreationInputSchema = z.object({
	id: NonEmptyStringSchema
});

export const SaveDraftInputSchema = z.object({
	draft: DraftRecordSchema
});

export const GetDraftInputSchema = z.object({});

export const ClearDraftInputSchema = z.object({});

export const CreationRecordResultSchema = resultSchema(CreationRecordSchema);
export const CreationListResultSchema = resultSchema(z.array(CreationRecordSchema));
export const DeleteResultSchema = resultSchema(z.boolean());
export const DraftSaveResultSchema = resultSchema(DraftRecordSchema);
export const DraftResultSchema = resultSchema(DraftRecordSchema.nullable());
export const DraftDeleteResultSchema = resultSchema(z.boolean());

export type CreationOwner = z.infer<typeof CreationOwnerSchema>;
export type CreationImage = z.infer<typeof CreationImageSchema>;
export type StoredStyleSelection = z.infer<typeof StyleSelectionSchema>;
export type CreationRecord = z.infer<typeof CreationRecordSchema>;
export type DraftRecord = z.infer<typeof DraftRecordSchema>;
export type SaveCreationInput = z.infer<typeof SaveCreationInputSchema>;
export type ListCreationsInput = z.infer<typeof ListCreationsInputSchema>;
export type GetCreationInput = z.infer<typeof GetCreationInputSchema>;
export type DeleteCreationInput = z.infer<typeof DeleteCreationInputSchema>;
export type SaveDraftInput = z.infer<typeof SaveDraftInputSchema>;
export type GetDraftInput = z.infer<typeof GetDraftInputSchema>;
export type ClearDraftInput = z.infer<typeof ClearDraftInputSchema>;
export type CreationRecordResult = z.infer<typeof CreationRecordResultSchema>;
export type CreationListResult = z.infer<typeof CreationListResultSchema>;
export type DeleteResult = z.infer<typeof DeleteResultSchema>;
export type DraftSaveResult = z.infer<typeof DraftSaveResultSchema>;
export type DraftResult = z.infer<typeof DraftResultSchema>;
export type DraftDeleteResult = z.infer<typeof DraftDeleteResultSchema>;

export type CreationStoreSeam = {
	saveCreation(input: SaveCreationInput): Promise<Result<CreationRecord>>;
	listCreations(input: ListCreationsInput): Promise<Result<CreationRecord[]>>;
	getCreation(input: GetCreationInput): Promise<Result<CreationRecord | null>>;
	deleteCreation(input: DeleteCreationInput): Promise<Result<boolean>>;
	saveDraft(input: SaveDraftInput): Promise<Result<DraftRecord>>;
	getDraft(input: GetDraftInput): Promise<Result<DraftRecord | null>>;
	clearDraft(input: ClearDraftInput): Promise<Result<boolean>>;
};
