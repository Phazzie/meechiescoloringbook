/*
 * Purpose: Canonical MeechieStudioTextSeam adapter implementation.
 * Why: Route AI wording actions through ProviderAdapterSeam without exposing provider details, using pre-charged quota context.
 * Info flow: Studio text input -> pipeline -> contract result.
 * Invariants: Calls runMeechieStudioTextPipeline; returns strict Result envelope; caller must supply complete dependencies including quota gate.
 */
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
	deps: MeechieStudioTextPipelineDeps
): MeechieStudioTextSeam => ({
	respond: async (input: MeechieStudioTextInput): Promise<Result<MeechieStudioTextOutput>> => {
		const response = await runMeechieStudioTextPipeline(input, deps);
		return response.body;
	}
});
