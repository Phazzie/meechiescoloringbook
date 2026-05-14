// Purpose: HTTP API contract types for the /api/image-generation endpoint.
// Why: Define the wire format between generate-pipeline and the image-generation route.
// Info flow: generate-pipeline HTTP call -> image-generation route -> these types validate both ends.
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
export type ImageGenerationInput = z.infer<typeof ImageGenerationInputSchema>;
export type ImageGenerationOutput = z.infer<typeof ImageGenerationOutputSchema>;
