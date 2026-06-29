// Purpose: Adapter implementation for MeechieStudioTextSeam.
// Why: Route AI wording actions through ProviderAdapterSeam without exposing provider details.
// Info flow: Studio text input -> pipeline -> contract result.
import { env } from '$env/dynamic/private';
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
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

// Reuses the shared providerAdapter singleton (rather than constructing a fresh adapter per
// call) so its circuit breaker accumulates failures across requests instead of resetting on
// every invocation.
const createDefaultDeps = (): MeechieStudioTextPipelineDeps => ({
	createProvider: () => providerAdapter,
	textModel: env.XAI_TEXT_MODEL,
	isProduction: env.NODE_ENV === 'production'
});

export const createMeechieStudioTextAdapter = (
	deps: MeechieStudioTextPipelineDeps = createDefaultDeps()
): MeechieStudioTextSeam => ({
	respond: async (input: MeechieStudioTextInput): Promise<Result<MeechieStudioTextOutput>> => {
		const response = await runMeechieStudioTextPipeline(input, deps);
		return response.body;
	}
});

export const meechieStudioTextAdapter = createMeechieStudioTextAdapter();
