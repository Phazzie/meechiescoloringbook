// Purpose: Define the OutputPackagingSeam contract.
// Why: Package generated images into downloadable artifacts.
// Info flow: Generated images -> packaged files for download.
import { z } from 'zod';
import { OutputFormatSchema, PageSizeSchema } from './spec-validation.contract';
import { GeneratedImageSchema } from './image-generation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const OutputVariantSchema = z.enum(['print', 'square', 'chat']);

export const PackagedFileSchema = z.object({
	filename: NonEmptyStringSchema,
	mimeType: NonEmptyStringSchema,
	dataBase64: NonEmptyStringSchema
});

export const OutputPackagingInputSchema = z.object({
	images: z.array(GeneratedImageSchema),
	outputFormat: OutputFormatSchema,
	fileBaseName: NonEmptyStringSchema,
	pageSize: PageSizeSchema,
	variants: z.array(OutputVariantSchema).min(1).optional()
});

export const OutputPackagingOutputSchema = z.object({
	files: z.array(PackagedFileSchema)
});

export const OutputPackagingResultSchema = resultSchema(OutputPackagingOutputSchema);

export type PackagedFile = z.infer<typeof PackagedFileSchema>;
export type OutputPackagingInput = z.infer<typeof OutputPackagingInputSchema>;
export type OutputPackagingOutput = z.infer<typeof OutputPackagingOutputSchema>;

export type OutputPackagingSeam = {
	package(input: OutputPackagingInput): Promise<Result<OutputPackagingOutput>>;
};
