// Purpose: Define DriftDetectionSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { z } from 'zod';
import type {
	ViolationSchema,
	RecommendedFixSchema,
	DriftDetectionInputSchema,
	DriftDetectionOutputSchema
} from './validators';
import type { Result } from '../../../../contracts/shared.contract';

export type Violation = z.infer<typeof ViolationSchema>;
export type RecommendedFix = z.infer<typeof RecommendedFixSchema>;
export type DriftDetectionInput = z.infer<typeof DriftDetectionInputSchema>;
export type DriftDetectionOutput = z.infer<typeof DriftDetectionOutputSchema>;

export type DriftDetectionSeam = {
	detect(input: DriftDetectionInput): Promise<Result<DriftDetectionOutput>>;
};
