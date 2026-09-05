/*
 * Purpose: Define the canonical OutputPackagingSeam contract and schemas.
 * Why: Package generated coloring page images into print and share artifacts.
 * Info flow: Generated images -> OutputPackagingSeam -> packaged files (PDF/PNG).
 * Invariants: Input must specify fileBaseName and valid pageSize/outputFormat; returns Result envelope.
 */
import { z } from 'zod';
import { OutputFormatSchema, PageSizeSchema } from '../spec-validation-seam/contract';
import { GeneratedImageSchema } from '../../../../contracts/image-generation.contract';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';

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

export type OutputVariant = z.infer<typeof OutputVariantSchema>;
export type PackagedFile = z.infer<typeof PackagedFileSchema>;
export type OutputPackagingInput = z.infer<typeof OutputPackagingInputSchema>;
export type OutputPackagingOutput = z.infer<typeof OutputPackagingOutputSchema>;
export type OutputPackagingResult = z.infer<typeof OutputPackagingResultSchema>;

export type OutputPackagingSeam = {
	package(input: OutputPackagingInput): Promise<Result<OutputPackagingOutput>>;
};
