// Purpose: Define the ImageGenerationSeam contract.
// Why: Generate deterministic images without exposing rendering internals.
// Info flow: Spec + prompt -> generated image assets.
import { z } from 'zod';
import { ColoringPageSpecSchema, OutputFormatSchema } from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const ImageDataEncodingSchema = z.enum(['utf8', 'base64']);

export const GeneratedImageSchema = z.object({
	id: NonEmptyStringSchema,
	format: z.enum(['svg', 'png']),
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

export const ImageGenerationResultSchema = resultSchema(ImageGenerationOutputSchema);

export type GeneratedImage = z.infer<typeof GeneratedImageSchema>;
export type ImageGenerationInput = z.infer<typeof ImageGenerationInputSchema>;
export type ImageGenerationOutput = z.infer<typeof ImageGenerationOutputSchema>;

export type ImageGenerationSeam = {
	generate(input: ImageGenerationInput): Promise<Result<ImageGenerationOutput>>;
};
