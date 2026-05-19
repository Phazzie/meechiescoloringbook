// MIGRATED: canonical location is src/lib/seams/drift-detection-seam/.
// This file re-exports from the new self-contained layout for backward compatibility.
// Update imports to use the new location directly.
export {
	ViolationSchema,
	RecommendedFixSchema,
	DriftDetectionInputSchema,
	DriftDetectionOutputSchema,
	DriftDetectionResultSchema,
	validateDriftDetectionInput,
	validateDriftDetectionResult
} from '../src/lib/seams/drift-detection-seam/validators';

export type {
	Violation,
	RecommendedFix,
	DriftDetectionInput,
	DriftDetectionOutput,
	DriftDetectionSeam
} from '../src/lib/seams/drift-detection-seam/contract';
