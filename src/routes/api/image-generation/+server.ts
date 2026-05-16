/*
Purpose: Server endpoint for ImageGenerationSeam — seam-based implementation using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> seam-based pipeline -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createAppConfigSeam } from '$lib/adapters/app-config-seam';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	// TODO: Narrow config dependency to image-provider keys only (AppConfigSeam currently requires text-model keys too)
	const pipelineResult = await runImageGenerationPipeline(body, {
		imageGenerationSeam: createImageGenerationSeam(createAppConfigSeam())
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
