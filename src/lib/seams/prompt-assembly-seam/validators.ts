// Purpose: Zod schemas for PromptAssemblySeam.
// Why: Centralise all validation logic so contract.ts stays type-only.
// Info flow: validators -> contract types / mock / adapter.
import { z } from 'zod';
import { ColoringPageSpecSchema } from '../spec-validation-seam/validators';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';

export const PromptAssemblyInputSchema = z.object({
	spec: ColoringPageSpecSchema,
	styleHint: NonEmptyStringSchema.optional()
});

export const PromptAssemblyOutputSchema = z.object({
	prompt: NonEmptyStringSchema,
	templateVersion: NonEmptyStringSchema
});

export const PromptAssemblyResultSchema = resultSchema(PromptAssemblyOutputSchema);

export const validatePromptAssemblyInput = (input: unknown) => PromptAssemblyInputSchema.parse(input);
export const validatePromptAssemblyResult = (result: unknown) => PromptAssemblyResultSchema.parse(result);
