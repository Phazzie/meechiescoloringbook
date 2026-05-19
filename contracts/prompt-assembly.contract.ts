// MIGRATED: canonical location is src/lib/seams/prompt-assembly-seam/.
// This file re-exports from the new self-contained layout for backward compatibility.
// Update imports to use the new location directly.
export {
	PromptAssemblyInputSchema,
	PromptAssemblyOutputSchema,
	PromptAssemblyResultSchema,
	validatePromptAssemblyInput,
	validatePromptAssemblyResult
} from '../src/lib/seams/prompt-assembly-seam/validators';

export type {
	PromptAssemblyInput,
	PromptAssemblyOutput,
	PromptAssemblySeam
} from '../src/lib/seams/prompt-assembly-seam/contract';
