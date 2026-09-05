/*
 * Purpose: Define canonical ProviderAdapterSeam contract for external AI APIs.
 * Why: Isolate network, auth, retry, and cancellation behavior behind a single boundary.
 * Info flow: Core seams -> provider adapter -> external AI service.
 * Invariants: Input schemas support optional AbortSignal for cancellation; image responses support url or b64_json; Result envelope returned.
 */
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';

export const ProviderChatMessageSchema = z.object({
	role: z.enum(['system', 'user', 'assistant']),
	content: NonEmptyStringSchema
});

export const ProviderChatInputSchema = z.object({
	model: NonEmptyStringSchema,
	messages: z.array(ProviderChatMessageSchema),
	responseFormat: z.record(z.unknown()).optional(),
	signal: z.instanceof(AbortSignal).optional()
});

export const ProviderChatOutputSchema = z.object({
	model: NonEmptyStringSchema,
	content: NonEmptyStringSchema
});

export const ProviderImageInputSchema = z.object({
	model: NonEmptyStringSchema,
	prompt: NonEmptyStringSchema,
	n: z.number().int().min(1).max(10),
	responseFormat: z.enum(['url', 'b64_json']),
	signal: z.instanceof(AbortSignal).optional()
});

export const ProviderImageSchema = z
	.object({
		url: NonEmptyStringSchema.optional(),
		b64_json: NonEmptyStringSchema.optional()
	})
	.refine((value) => !!value.url || !!value.b64_json, {
		message: 'image must include url or b64_json'
	});

export const ProviderImageOutputSchema = z.object({
	images: z.array(ProviderImageSchema),
	revisedPrompt: NonEmptyStringSchema.optional()
});

export const ProviderChatResultSchema = resultSchema(ProviderChatOutputSchema);
export const ProviderImageResultSchema = resultSchema(ProviderImageOutputSchema);

export type ProviderChatMessage = z.infer<typeof ProviderChatMessageSchema>;
export type ProviderChatInput = z.infer<typeof ProviderChatInputSchema>;
export type ProviderChatOutput = z.infer<typeof ProviderChatOutputSchema>;
export type ProviderChatResult = z.infer<typeof ProviderChatResultSchema>;
export type ProviderImageInput = z.infer<typeof ProviderImageInputSchema>;
export type ProviderImageOutput = z.infer<typeof ProviderImageOutputSchema>;
export type ProviderImageResult = z.infer<typeof ProviderImageResultSchema>;

export type ProviderAdapterSeam = {
	createChatCompletion(
		input: ProviderChatInput
	): Promise<Result<ProviderChatOutput>>;
	createImageGeneration(
		input: ProviderImageInput
	): Promise<Result<ProviderImageOutput>>;
};
