/*
Purpose: Server endpoint for ImageGenerationSeam — seam-based implementation using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> seam-based pipeline -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { enforceRateLimit } from '$lib/server/rate-limit-guard';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const rateLimit = enforceRateLimit('image-generation', event);
	if (!rateLimit.ok) return rateLimit.response;

	const { request } = event;
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runImageGenerationPipeline(parsed.body, {
		imageGenerationSeam: createImageGenerationSeam(createImageProviderConfigSeam()),
		signal: request.signal
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
