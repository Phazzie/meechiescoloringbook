// Purpose: Define the `/api/generate` orchestration request and response contract.
// Why: Keep client/server generation orchestration deterministic and schema-validated.
// Info flow: UI spec input -> server orchestration -> prompt/images/drift payload.
import { z } from 'zod';
import { DriftDetectionOutputSchema } from './drift-detection.contract';
import { ImageGenerationOutputSchema } from './image-generation.contract';
import { PromptAssemblyOutputSchema } from './prompt-assembly.contract';
import { ColoringPageSpecSchema } from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';

// Bounds the cost of the SafetyPolicySeam scan that runs ahead of rate
// limiting (see checkGenerateSafety) — far above any genuine style hint, so
// it never rejects legitimate requests.
const MAX_STYLE_HINT_LENGTH = 2000;

export const GenerateRequestSchema = z.object({
	spec: ColoringPageSpecSchema,
	styleHint: NonEmptyStringSchema.max(MAX_STYLE_HINT_LENGTH).optional()
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
