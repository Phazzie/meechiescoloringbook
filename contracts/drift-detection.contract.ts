// Purpose: Define the DriftDetectionSeam contract.
// Why: Detect prompt drift and constraint violations.
// Info flow: Spec + prompts -> violations + fixes.
import { z } from 'zod';
import { ColoringPageSpecSchema } from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

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

export type Violation = z.infer<typeof ViolationSchema>;
export type DriftDetectionInput = z.infer<typeof DriftDetectionInputSchema>;
export type DriftDetectionOutput = z.infer<typeof DriftDetectionOutputSchema>;

export type DriftDetectionSeam = {
	detect(input: DriftDetectionInput): Promise<Result<DriftDetectionOutput>>;
};
