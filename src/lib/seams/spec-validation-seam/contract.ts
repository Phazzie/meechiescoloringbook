// Purpose: Define SpecValidationSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { z } from 'zod';
import type {
	ColoringPageSpecSchema,
	PageSizeSchema,
	SpecValidationInputSchema,
	SpecValidationOutputSchema
} from './validators';

export type ColoringPageSpec = z.infer<typeof ColoringPageSpecSchema>;
export type PageSize = z.infer<typeof PageSizeSchema>;
export type SpecValidationInput = z.infer<typeof SpecValidationInputSchema>;
export type SpecValidationOutput = z.infer<typeof SpecValidationOutputSchema>;

export type SpecValidationSeam = {
	validate(input: SpecValidationInput): Promise<SpecValidationOutput>;
};
