// Purpose: Define AI text generation for the Meechie studio.
// Why: Keep verdict, quote, and coloring-page text generation contract-backed.
// Info flow: Studio text request -> provider-backed adapter -> structured Meechie output.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';
import { MAX_FREE_TEXT_LENGTH } from '../src/lib/core/constants';

export { MAX_FREE_TEXT_LENGTH };

// Bounds the cost of the disallowed-keyword scan that runs ahead of rate
// limiting (see checkMeechieStudioTextSafety) — far above any genuine studio
// input, so it never rejects legitimate requests.
const MAX_LABEL_LENGTH = 200;
const FreeTextSchema = NonEmptyStringSchema.max(MAX_FREE_TEXT_LENGTH);
const LabelTextSchema = NonEmptyStringSchema.max(MAX_LABEL_LENGTH);

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
	verdict: FreeTextSchema,
	quote: FreeTextSchema,
	pageTitle: LabelTextSchema,
	pageItems: z.array(LabelTextSchema).min(2).max(6),
	rating: z.number().int().min(1).max(10).optional()
});

export const MeechieStudioTextInputSchema = z.object({
	actionId: MeechieStudioTextActionSchema,
	modeId: LabelTextSchema,
	modeLabel: LabelTextSchema,
	themeLabel: LabelTextSchema,
	evidence: FreeTextSchema,
	dedication: FreeTextSchema.optional(),
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
	label: LabelTextSchema
});

// verdict/quote/pageTitle/pageItems[].label are capped to match
// MeechieStudioCurrentTextSchema above: studio-state.svelte.ts echoes this output back
// as the next request's currentText, so an uncapped provider output here would pass this
// schema but fail input validation on the very next round, stranding the user.
export const MeechieStudioTextOutputSchema = z.object({
	verdict: FreeTextSchema,
	quote: FreeTextSchema,
	pageTitle: LabelTextSchema,
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
