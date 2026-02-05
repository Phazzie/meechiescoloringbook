// Purpose: Define the ProviderAdapterSeam contract for external AI APIs.
// Why: Isolate network/auth/retry behavior behind a single boundary.
// Info flow: Core seams -> provider adapter -> external service.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const ProviderChatMessageSchema = z.object({
	role: z.enum(['system', 'user', 'assistant']),
	content: NonEmptyStringSchema
});

export const ProviderChatInputSchema = z.object({
	model: NonEmptyStringSchema,
	messages: z.array(ProviderChatMessageSchema)
});

export const ProviderChatOutputSchema = z.object({
	model: NonEmptyStringSchema,
	content: NonEmptyStringSchema
});

export const ProviderImageInputSchema = z.object({
	model: NonEmptyStringSchema,
	prompt: NonEmptyStringSchema,
	n: z.number().int().min(1).max(10),
	responseFormat: z.enum(['url', 'b64_json'])
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

export type ProviderChatInput = z.infer<typeof ProviderChatInputSchema>;
export type ProviderChatOutput = z.infer<typeof ProviderChatOutputSchema>;
export type ProviderImageInput = z.infer<typeof ProviderImageInputSchema>;
export type ProviderImageOutput = z.infer<typeof ProviderImageOutputSchema>;

export type ProviderAdapterSeam = {
	createChatCompletion(input: ProviderChatInput): Promise<Result<ProviderChatOutput>>;
	createImageGeneration(input: ProviderImageInput): Promise<Result<ProviderImageOutput>>;
};
