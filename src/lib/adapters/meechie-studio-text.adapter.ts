// Purpose: Adapter implementation for MeechieStudioTextSeam.
// Why: Route AI wording actions through ProviderAdapterSeam without exposing provider details.
// Info flow: Studio text input -> pipeline -> contract result.
import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
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

export const createMeechieStudioTextAdapter = (
	deps: MeechieStudioTextPipelineDeps = { createProvider: createProviderAdapter }
): MeechieStudioTextSeam => ({
	respond: async (input: MeechieStudioTextInput): Promise<Result<MeechieStudioTextOutput>> => {
		const response = await runMeechieStudioTextPipeline(input, deps);
		return response.body;
	}
});

export const meechieStudioTextAdapter = createMeechieStudioTextAdapter();
