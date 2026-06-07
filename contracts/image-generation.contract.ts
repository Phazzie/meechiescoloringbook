// Purpose: Define the HTTP API schemas for the /api/image-generation endpoint.
// Why: Keep the generate pipeline and UI routes decoupled from xAI internals via shared Zod types.
// Info flow: generate pipeline -> ImageGenerationInputSchema (request) / ImageGenerationResultSchema (response) -> UI routes.
// Note: The ImageGenerationSeam interface (xAI adapter contract) lives in src/lib/seams/image-generation-seam/contract.ts.
import { z } from 'zod';
import {
	ColoringPageSpecSchema,
	OutputFormatSchema
} from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';

export const ImageDataEncodingSchema = z.enum(['utf8', 'base64']);

export const GeneratedImageSchema = z.object({
	id: NonEmptyStringSchema,
	format: z.enum(['svg', 'png', 'jpg', 'webp']),
	mimeType: NonEmptyStringSchema,
	data: NonEmptyStringSchema,
	encoding: ImageDataEncodingSchema
});

export const ImageGenerationInputSchema = z.object({
	spec: ColoringPageSpecSchema,
	prompt: NonEmptyStringSchema,
	variations: z.number().int().min(1).max(4),
	outputFormat: OutputFormatSchema
});

export const ImageGenerationOutputSchema = z.object({
	images: z.array(GeneratedImageSchema),
	revisedPrompt: NonEmptyStringSchema.optional(),
	modelMetadata: z
		.object({
			provider: NonEmptyStringSchema,
			model: NonEmptyStringSchema
		})
		.optional()
});

export const ImageGenerationResultSchema = resultSchema(
	ImageGenerationOutputSchema
);

export type GeneratedImage = z.infer<typeof GeneratedImageSchema>;
export type ImageGenerationInput = z.infer<typeof ImageGenerationInputSchema>;
export type ImageGenerationOutput = z.infer<typeof ImageGenerationOutputSchema>;
