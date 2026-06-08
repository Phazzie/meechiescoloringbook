// Purpose: Define the `/api/generate` orchestration request and response contract.
// Why: Keep client/server generation orchestration deterministic and schema-validated.
// Info flow: UI spec input -> server orchestration -> prompt/images/drift payload.
import { z } from 'zod';
import { DriftDetectionOutputSchema } from '../src/lib/seams/drift-detection-seam/contract';
import { ImageGenerationOutputSchema } from './image-generation.contract';
import { PromptAssemblyOutputSchema } from '../src/lib/seams/prompt-assembly-seam/contract';
import { ColoringPageSpecSchema } from '../src/lib/seams/spec-validation-seam/contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';

export const GenerateRequestSchema = z.object({
	spec: ColoringPageSpecSchema,
	styleHint: NonEmptyStringSchema.optional()
});

export const GenerateResponseValueSchema = z.object({
	prompt: PromptAssemblyOutputSchema.shape.prompt,
	templateVersion: PromptAssemblyOutputSchema.shape.templateVersion,
	images: ImageGenerationOutputSchema.shape.images,
	revisedPrompt: ImageGenerationOutputSchema.shape.revisedPrompt,
	modelMetadata: ImageGenerationOutputSchema.shape.modelMetadata,
	violations: DriftDetectionOutputSchema.shape.violations,
	recommendedFixes: DriftDetectionOutputSchema.shape.recommendedFixes
});

export const GenerateResultSchema = resultSchema(GenerateResponseValueSchema);

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponseValue = z.infer<typeof GenerateResponseValueSchema>;
