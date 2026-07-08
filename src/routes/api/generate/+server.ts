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
import { parseRequestBody } from '$lib/server/parse-request-body';
import { guardRateLimit, RATE_LIMIT_CONFIGS } from '$lib/server/rate-limit-guard';
import { createSafetyPolicySeam } from '$lib/seams/safety-policy-seam/policy';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const guard = guardRateLimit('generate', getClientAddress, RATE_LIMIT_CONFIGS.generate);
	if (!guard.ok) return guard.response;
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
