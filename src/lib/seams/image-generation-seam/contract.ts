// Purpose: Define ImageGenerationSeam contract types and schemas.
// Why: Keep the self-contained seam aligned with the active Result-based image-generation contract.
// Info flow: contract schemas/types -> validators/mock/test/adapter.
import {
	ImageGenerationInputSchema,
	GeneratedImageSchema,
	ImageGenerationOutputSchema,
	ImageGenerationResultSchema,
	type ImageGenerationInput,
	type GeneratedImage as ContractGeneratedImage,
	type ImageGenerationOutput as ContractImageGenerationOutput
} from '../../../../contracts/image-generation.contract';
import type { Result } from '../../../../contracts/shared.contract';

export const imageGenerationRequestSchema = ImageGenerationInputSchema;
export const generatedImageSchema = GeneratedImageSchema;
export const imageGenerationOutputSchema = ImageGenerationOutputSchema;
export const imageGenerationResultSchema = ImageGenerationResultSchema;

export type ImageGenerationRequest = ImageGenerationInput;
export type GeneratedImage = ContractGeneratedImage;
export type ImageGenerationOutput = ContractImageGenerationOutput;
export type ImageGenerationResult = Result<ImageGenerationOutput>;

export type ImageGenerationSeam = {
generate: (request: ImageGenerationRequest) => Promise<ImageGenerationResult>;
};
