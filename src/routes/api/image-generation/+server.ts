/*
Purpose: Server endpoint for ImageGenerationSeam using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> provider adapter -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import {
	imageGenerationPipelineDeps,
	runImageGenerationPipeline
} from '$lib/core/image-generation-pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const pipelineResult = await runImageGenerationPipeline(body, request.headers, imageGenerationPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
