// Purpose: Define AI text generation for the Meechie studio.
// Why: Keep verdict, quote, and coloring-page text generation contract-backed.
// Info flow: Studio text request -> provider-backed adapter -> structured Meechie output.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const MeechieStudioTextActionSchema = z.enum([
	'generate',
	'regenerate',
	'make_prettier',
	'make_meaner',
	'make_more_specific'
]);

export const MeechieStudioVoiceSettingsSchema = z.object({
	intensity: z.enum(['receipts_out', 'church_lady', 'no_mercy']),
	rawness: z.enum(['mild', 'medium', 'raw']),
	thirdPerson: z.enum(['sometimes', 'always', 'never'])
});

export const MeechieStudioCurrentTextSchema = z.object({
	verdict: NonEmptyStringSchema,
	quote: NonEmptyStringSchema,
	pageTitle: NonEmptyStringSchema,
	pageItems: z.array(NonEmptyStringSchema).min(2).max(6),
	rating: z.number().int().min(1).max(10).optional()
});

export const MeechieStudioTextInputSchema = z.object({
	actionId: MeechieStudioTextActionSchema,
	modeId: NonEmptyStringSchema,
	modeLabel: NonEmptyStringSchema,
	themeLabel: NonEmptyStringSchema,
	evidence: NonEmptyStringSchema,
	dedication: NonEmptyStringSchema.optional(),
	voice: MeechieStudioVoiceSettingsSchema,
	currentText: MeechieStudioCurrentTextSchema.optional()
});

export const MeechieStudioQualityStateSchema = z.enum([
	'ready',
	'needs_more_evidence',
	'blocked'
]);

export const MeechieStudioPageItemSchema = z.object({
	number: z.number().int().min(1).max(999),
	label: NonEmptyStringSchema
});

export const MeechieStudioTextOutputSchema = z.object({
	verdict: NonEmptyStringSchema,
	quote: NonEmptyStringSchema,
	pageTitle: NonEmptyStringSchema,
	pageItems: z.array(MeechieStudioPageItemSchema).min(2).max(6),
	rating: z.number().int().min(1).max(10).optional(),
	qualityState: MeechieStudioQualityStateSchema,
	revisionNote: NonEmptyStringSchema.optional(),
	modelMetadata: z
		.object({
			provider: NonEmptyStringSchema,
			model: NonEmptyStringSchema
		})
		.optional()
});

export const MeechieStudioTextResultSchema = resultSchema(MeechieStudioTextOutputSchema);

export type MeechieStudioTextAction = z.infer<typeof MeechieStudioTextActionSchema>;
export type MeechieStudioVoiceSettings = z.infer<typeof MeechieStudioVoiceSettingsSchema>;
export type MeechieStudioCurrentText = z.infer<typeof MeechieStudioCurrentTextSchema>;
export type MeechieStudioTextInput = z.infer<typeof MeechieStudioTextInputSchema>;
export type MeechieStudioTextOutput = z.infer<typeof MeechieStudioTextOutputSchema>;

export type MeechieStudioTextSeam = {
	respond(input: MeechieStudioTextInput): Promise<Result<MeechieStudioTextOutput>>;
};
