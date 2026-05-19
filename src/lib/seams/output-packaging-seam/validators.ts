// Purpose: Zod schemas for OutputPackagingSeam.
// Why: Centralise all validation logic so contract.ts stays type-only.
// Info flow: validators -> contract types / mock / adapter.
import { z } from 'zod';
import { OutputFormatSchema, PageSizeSchema } from '../spec-validation-seam/validators';
import { GeneratedImageSchema } from '../../../../contracts/image-generation.contract';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';

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

export const validateOutputPackagingInput = (input: unknown) => OutputPackagingInputSchema.parse(input);
export const validateOutputPackagingResult = (result: unknown) => OutputPackagingResultSchema.parse(result);
