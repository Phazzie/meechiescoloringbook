// Purpose: Adapter implementation for MeechieStudioTextSeam.
// Why: Route AI wording actions through ProviderAdapterSeam without exposing provider details.
// Info flow: Studio text input -> pipeline -> contract result.
import {
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import type {
	MeechieStudioTextInput,
	MeechieStudioTextOutput,
	MeechieStudioTextSeam
} from '../../../contracts/meechie-studio-text.contract';
import type { Result } from '../../../contracts/shared.contract';

/**
 * Deps are required. They used to default to a provider plus a runtime-mode flag, but the pipeline
 * now requires a quota gate, and a gate can only be built from a caller's RequestEvent. A default
 * here would have to invent one, which is exactly the unmetered production path the plan forbids -
 * so the caller supplies the whole set, including the gate it built from its own event.
 */
export const createMeechieStudioTextAdapter = (
	deps: MeechieStudioTextPipelineDeps
): MeechieStudioTextSeam => ({
	respond: async (input: MeechieStudioTextInput): Promise<Result<MeechieStudioTextOutput>> => {
		const response = await runMeechieStudioTextPipeline(input, deps);
		return response.body;
	}
});
