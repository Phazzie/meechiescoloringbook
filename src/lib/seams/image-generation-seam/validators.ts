// Purpose: Validate ImageGenerationSeam inputs and outputs.
// Why: Keep runtime data aligned with the self-contained seam contract.
// Info flow: adapter/mock/tests -> validators -> typed contract data.
import {
	generatedImageSchema,
	imageGenerationRequestSchema,
	imageGenerationResultSchema
} from './contract';

export const validateImageGenerationRequest = (input: unknown) =>
imageGenerationRequestSchema.parse(input);

export const validateImageGenerationResult = (input: unknown) =>
	imageGenerationResultSchema.parse(input);

export { generatedImageSchema };
