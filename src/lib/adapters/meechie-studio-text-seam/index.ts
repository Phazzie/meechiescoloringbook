// Purpose: Adapter implementation for MeechieStudioTextSeam.
// Why: Route AI wording actions through ProviderAdapterSeam without exposing provider details.
// Info flow: Studio text input -> pipeline -> contract result.
import { createProviderAdapter } from '$lib/adapters/provider-adapter-seam';
import {
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import type {
	MeechieStudioTextInput,
	MeechieStudioTextOutput,
	MeechieStudioTextSeam
} from '../../seams/meechie-studio-text-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

export const createMeechieStudioTextAdapter = (
	deps: MeechieStudioTextPipelineDeps = { createProvider: createProviderAdapter }
): MeechieStudioTextSeam => ({
	respond: async (input: MeechieStudioTextInput): Promise<Result<MeechieStudioTextOutput>> => {
		const response = await runMeechieStudioTextPipeline(input, deps);
		return response.body;
	}
});

export const meechieStudioTextAdapter = createMeechieStudioTextAdapter();
