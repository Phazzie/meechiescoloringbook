/*
Purpose: Server endpoint for ImageGenerationSeam — seam-based implementation using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> seam-based pipeline -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import {
	checkImageGenerationAbort,
	checkImageGenerationCircuitOpen,
	checkImageGenerationInputShape,
	checkImageGenerationProviderConfig,
	checkImageGenerationPromptGuard,
	runImageGenerationPipeline
} from '$lib/core/image-generation-pipeline';
import { createImageGenerationSeam, isImageGenerationCircuitOpen } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const abortCheck = checkImageGenerationAbort(request.signal);
	if (!abortCheck.ok) return json(abortCheck.response.body, { status: abortCheck.response.status });
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const shapeCheck = checkImageGenerationInputShape(parsed.body);
	if (!shapeCheck.ok) return json(shapeCheck.response.body, { status: shapeCheck.response.status });
	const promptGuardCheck = checkImageGenerationPromptGuard(shapeCheck.data);
	if (!promptGuardCheck.ok)
		return json(promptGuardCheck.response.body, { status: promptGuardCheck.response.status });
	const lateAbortCheck = checkImageGenerationAbort(request.signal);
	if (!lateAbortCheck.ok)
		return json(lateAbortCheck.response.body, { status: lateAbortCheck.response.status });
	const configSeam = createImageProviderConfigSeam();
	const configCheck = checkImageGenerationProviderConfig(configSeam);
	if (!configCheck.ok)
		return json(configCheck.response.body, { status: configCheck.response.status });
	const circuitCheck = checkImageGenerationCircuitOpen(isImageGenerationCircuitOpen());
	if (!circuitCheck.ok)
		return json(circuitCheck.response.body, { status: circuitCheck.response.status });
	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;
	const pipelineResult = await runImageGenerationPipeline(parsed.body, {
		imageGenerationSeam: createImageGenerationSeam(configSeam),
		signal: request.signal
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
