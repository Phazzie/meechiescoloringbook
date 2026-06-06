// Purpose: Validate SpecValidationSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { SpecValidationInputSchema, SpecValidationOutputSchema } from './contract';

export const validateSpecValidationInput = (input: unknown) =>
	SpecValidationInputSchema.parse(input);

export const validateSpecValidationOutput = (output: unknown) =>
	SpecValidationOutputSchema.parse(output);
