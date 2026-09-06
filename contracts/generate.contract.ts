// Purpose: Define the `/api/generate` orchestration request and response contract.
// Why: Keep client/server generation orchestration deterministic and schema-validated.
// Info flow: UI spec input -> server orchestration -> prompt/images/drift payload.
import { z } from 'zod';
import { DriftDetectionOutputSchema } from './drift-detection.contract';
import { ImageGenerationOutputSchema } from './image-generation.contract';
import { PromptAssemblyOutputSchema } from './prompt-assembly.contract';
import { ColoringPageSpecSchema } from './spec-validation.contract';
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
	recommendedFixes: DriftDetectionOutputSchema.shape.recommendedFixes,
	/**
	 * Why the drift check returned no verdict, when it returned none.
	 *
	 * Absent means the check ran and `violations` is its answer. Present means it declined to grade
	 * and `violations` is empty because nothing was looked at — not because nothing was wrong.
	 *
	 * This field exists because those two states were previously indistinguishable. The pipeline
	 * mapped a `DriftDetectionSeam` failure to `violations: []`, and every consumer reads an empty
	 * violation list as "nothing wrong with this page". That mattered far more than it sounds: the
	 * seam grades `revisedPrompt` in preference to `promptSent`, and a provider rewrite carries none
	 * of the required headings, so the provider discarding the page's constraints — the event drift
	 * detection exists to catch — took the failure branch every time and was reported as clean.
	 *
	 * Carried as an explicit optional field rather than as a reserved `code` inside `violations`,
	 * so the distinction lives in the contract where every consumer can see it, instead of in a
	 * magic string only this app's UI knows how to interpret.
	 */
	driftCheckFailure: z
		.object({ code: NonEmptyStringSchema, message: NonEmptyStringSchema })
		.optional()
});

export const GenerateResultSchema = resultSchema(GenerateResponseValueSchema);

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponseValue = z.infer<typeof GenerateResponseValueSchema>;
