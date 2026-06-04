// Purpose: Validate PromptAssemblySeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { PromptAssemblyInputSchema, PromptAssemblyResultSchema } from './contract';

export const validatePromptAssemblyInput = (input: unknown) =>
	PromptAssemblyInputSchema.parse(input);

export const validatePromptAssemblyResult = (result: unknown) =>
	PromptAssemblyResultSchema.parse(result);
