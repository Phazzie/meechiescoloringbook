// Purpose: Validate DriftDetectionSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { DriftDetectionInputSchema, DriftDetectionResultSchema } from './contract';

export const validateDriftDetectionInput = (input: unknown) =>
	DriftDetectionInputSchema.parse(input);

export const validateDriftDetectionResult = (result: unknown) =>
	DriftDetectionResultSchema.parse(result);
