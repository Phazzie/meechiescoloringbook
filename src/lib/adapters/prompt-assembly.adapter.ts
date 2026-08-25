// Purpose: Legacy import compatibility for PromptAssemblySeam.
// Why: Keep one canonical implementation while older callers migrate.
// Info flow: Legacy import -> canonical self-contained adapter.
import type { PromptAssemblySeam } from '../../../contracts/prompt-assembly.contract';
import { promptAssemblyAdapter as canonicalPromptAssemblyAdapter } from './prompt-assembly-seam';

export const promptAssemblyAdapter: PromptAssemblySeam =
	canonicalPromptAssemblyAdapter;
