// Purpose: Zod schemas for DriftDetectionSeam.
// Why: Centralise all validation logic so contract.ts stays type-only.
// Info flow: validators -> contract types / mock / adapter.
import { z } from 'zod';
import { ColoringPageSpecSchema } from '../spec-validation-seam/validators';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';

export const ViolationSchema = z.object({
	code: NonEmptyStringSchema,
	message: NonEmptyStringSchema,
	severity: z.enum(['error', 'warning'])
});

export const RecommendedFixSchema = z.object({
	code: NonEmptyStringSchema,
	message: NonEmptyStringSchema
});

export const DriftDetectionInputSchema = z.object({
	spec: ColoringPageSpecSchema,
	promptSent: NonEmptyStringSchema,
	revisedPrompt: NonEmptyStringSchema.optional()
});

export const DriftDetectionOutputSchema = z.object({
	violations: z.array(ViolationSchema),
	confidenceScore: z.number().min(0).max(1),
	recommendedFixes: z.array(RecommendedFixSchema)
});

export const DriftDetectionResultSchema = resultSchema(DriftDetectionOutputSchema);

export const validateDriftDetectionInput = (input: unknown) => DriftDetectionInputSchema.parse(input);
export const validateDriftDetectionResult = (result: unknown) => DriftDetectionResultSchema.parse(result);
