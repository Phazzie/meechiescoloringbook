// Purpose: Define PromptAssemblySeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { z } from 'zod';
import type {
	PromptAssemblyInputSchema,
	PromptAssemblyOutputSchema
} from './validators';
import type { Result } from '../../../../contracts/shared.contract';

export type PromptAssemblyInput = z.infer<typeof PromptAssemblyInputSchema>;
export type PromptAssemblyOutput = z.infer<typeof PromptAssemblyOutputSchema>;

export type PromptAssemblySeam = {
	assemble(input: PromptAssemblyInput): Promise<Result<PromptAssemblyOutput>>;
};
