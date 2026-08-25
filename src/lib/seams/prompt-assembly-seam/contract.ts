// Purpose: Define the PromptAssemblySeam contract.
// Why: Convert a spec into a locked, deterministic prompt.
// Info flow: Spec -> prompt text -> downstream seams.
import { z } from 'zod';
import { ColoringPageSpecSchema } from '../spec-validation-seam/contract';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';

export const PromptAssemblyInputSchema = z.object({
	spec: ColoringPageSpecSchema,
	styleHint: NonEmptyStringSchema.optional()
});

export const PromptAssemblyOutputSchema = z.object({
	prompt: NonEmptyStringSchema,
	templateVersion: NonEmptyStringSchema
});

export const PromptAssemblyResultSchema = resultSchema(PromptAssemblyOutputSchema);

export type PromptAssemblyInput = z.infer<typeof PromptAssemblyInputSchema>;
export type PromptAssemblyOutput = z.infer<typeof PromptAssemblyOutputSchema>;
export type PromptAssemblyResult = z.infer<typeof PromptAssemblyResultSchema>;

export type PromptAssemblySeam = {
	assemble(input: PromptAssemblyInput): Promise<Result<PromptAssemblyOutput>>;
};
