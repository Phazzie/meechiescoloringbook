/*
Purpose: Orchestrate prompt assembly, image generation, and drift checks for the main UI.
Why: Keep generation flow server-driven behind a single endpoint.
Info flow: UI generate request -> validation -> prompt/image/drift seams -> JSON response.
*/
import { json } from '@sveltejs/kit';
import { generatePipelineDeps, runGeneratePipeline } from '$lib/core/generate-pipeline';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runGeneratePipeline(parsed.body, {
		imageGenerationSeam: createImageGenerationSeam(createImageProviderConfigSeam()),
		...generatePipelineDeps
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
