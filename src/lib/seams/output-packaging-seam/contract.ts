// Purpose: Define OutputPackagingSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { z } from 'zod';
import type {
	PackagedFileSchema,
	OutputPackagingInputSchema,
	OutputPackagingOutputSchema
} from './validators';
import type { Result } from '../../../../contracts/shared.contract';

export type PackagedFile = z.infer<typeof PackagedFileSchema>;
export type OutputPackagingInput = z.infer<typeof OutputPackagingInputSchema>;
export type OutputPackagingOutput = z.infer<typeof OutputPackagingOutputSchema>;

export type OutputPackagingSeam = {
	package(input: OutputPackagingInput): Promise<Result<OutputPackagingOutput>>;
};
