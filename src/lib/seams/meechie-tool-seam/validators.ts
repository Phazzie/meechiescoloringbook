// Purpose: Validate MeechieToolSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { MeechieToolInputSchema, MeechieToolResultSchema } from './contract';

export const validateMeechieToolInput = (input: unknown) =>
	MeechieToolInputSchema.parse(input);

export const validateMeechieToolResult = (result: unknown) =>
	MeechieToolResultSchema.parse(result);
