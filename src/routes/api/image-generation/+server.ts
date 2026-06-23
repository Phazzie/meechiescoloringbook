/*
Purpose: Server endpoint for ImageGenerationSeam — seam-based implementation using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> seam-based pipeline -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;
	const pipelineResult = await runImageGenerationPipeline(parsed.body, {
		imageGenerationSeam: createImageGenerationSeam(createImageProviderConfigSeam()),
		signal: request.signal
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
