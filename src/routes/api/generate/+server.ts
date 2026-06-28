/*
Purpose: Orchestrate prompt assembly, image generation, and drift checks for the main UI.
Why: Keep generation flow server-driven behind a single endpoint.
Info flow: UI generate request -> validation -> prompt/image/drift seams -> JSON response.
*/
import { json } from '@sveltejs/kit';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { generatePipelineDeps, runGeneratePipeline } from '$lib/core/generate-pipeline';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import { RATE_LIMIT_CONFIG } from '$lib/server/rate-limit-config';
import { checkRateLimit } from '$lib/server/rate-limit-guard';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createSafetyPolicySeam } from '$lib/seams/safety-policy-seam/policy';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rateLimit = checkRateLimit({
		routeName: 'generate',
		...RATE_LIMIT_CONFIG.generate,
		getClientAddress
	});
	if (!rateLimit.ok) return rateLimit.response;
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const imageGenerationSeam = createImageGenerationSeam(createImageProviderConfigSeam());
	const safetyPolicySeam = createSafetyPolicySeam();
	const pipelineResult = await runGeneratePipeline(parsed.body, {
		...generatePipelineDeps,
		checkContentSafety: safetyPolicySeam.validateGenerateRequest,
		generateImage: (body, signal) =>
			runImageGenerationPipeline(body, {
				imageGenerationSeam,
				signal: signal ?? request.signal
			}),
		signal: request.signal
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
