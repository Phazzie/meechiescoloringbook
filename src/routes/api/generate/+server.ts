/*
Purpose: Orchestrate prompt assembly, image generation, and drift checks for the main UI.
Why: Keep generation flow server-driven behind a single endpoint.
Info flow: UI generate request -> validation -> prompt/image/drift seams -> JSON response.
*/
import { json } from '@sveltejs/kit';
import { generatePipelineDeps, runGeneratePipeline } from '$lib/core/generate-pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json().catch(() => null);
	const pipelineResult = await runGeneratePipeline(body, request.headers, {
		fetchImpl: fetch,
		...generatePipelineDeps
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
