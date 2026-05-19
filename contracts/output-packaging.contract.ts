// MIGRATED: canonical location is src/lib/seams/output-packaging-seam/.
// This file re-exports from the new self-contained layout for backward compatibility.
// Update imports to use the new location directly.
export {
	OutputVariantSchema,
	PackagedFileSchema,
	OutputPackagingInputSchema,
	OutputPackagingOutputSchema,
	OutputPackagingResultSchema,
	validateOutputPackagingInput,
	validateOutputPackagingResult
} from '../src/lib/seams/output-packaging-seam/validators';

export type {
	PackagedFile,
	OutputPackagingInput,
	OutputPackagingOutput,
	OutputPackagingSeam
} from '../src/lib/seams/output-packaging-seam/contract';
