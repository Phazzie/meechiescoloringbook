/*
Purpose: Server endpoint for ImageGenerationSeam — seam-based implementation using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> per-request quota gate -> seam-based pipeline -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const parsed = await parseRequestBody(event.request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runImageGenerationPipeline(parsed.body, {
		imageGenerationSeam: createImageGenerationSeam(createImageProviderConfigSeam()),
		// This route is the only payer for its own images, so it charges. The gate is built from
		// this route's own event: without the real getClientAddress every caller would collapse
		// into one shared bucket.
		quota: { mode: 'charge', consumeQuota: createQuotaGate(event, 'image') },
		signal: event.request.signal
	});
	return json(pipelineResult.body, {
		status: pipelineResult.status,
		// Guard headers, verbatim, on denials and on post-charge responses alike.
		headers: pipelineResult.headers
	});
};
