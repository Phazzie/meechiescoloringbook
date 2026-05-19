// MIGRATED: canonical location is src/lib/seams/meechie-tool-seam/.
// This file re-exports from the new self-contained layout for backward compatibility.
// Update imports to use the new location directly.
export {
	MeechieToolIdSchema,
	MeechieToolInputSchema,
	MeechieToolOutputSchema,
	MeechieToolResultSchema,
	HoroscopeSignSchema,
	validateMeechieToolInput,
	validateMeechieToolResult
} from '../src/lib/seams/meechie-tool-seam/validators';

export type {
	MeechieToolId,
	MeechieToolInput,
	MeechieToolOutput,
	HoroscopeSign,
	MeechieToolSeam
} from '../src/lib/seams/meechie-tool-seam/contract';
