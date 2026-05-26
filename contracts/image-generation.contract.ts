// Purpose: Define the API-boundary types for the image-generation endpoint.
// Why: Shared types for the /api/image-generation request/response shape used by
//      the pipeline, generate-pipeline, and UI routes.
// Info flow: Spec + prompt -> generated image assets returned to the client.
import { z } from 'zod';
import {
	ColoringPageSpecSchema,
	OutputFormatSchema
} from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';

export const ImageDataEncodingSchema = z.enum(['utf8', 'base64']);

export const GeneratedImageSchema = z.object({
	id: NonEmptyStringSchema,
	format: z.enum(['svg', 'png', 'jpg']),
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
export type ImageGenerationOutput = z.infer<typeof ImageGenerationOutputSchema>;
