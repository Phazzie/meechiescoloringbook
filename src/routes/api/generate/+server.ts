/*
Purpose: Orchestrate prompt assembly, image generation, and drift checks for the main UI.
Why: Keep generation flow server-driven behind a single endpoint.
Info flow: UI generate request -> validation -> per-request quota gate -> prompt/image/drift seams -> JSON response.
*/
import { json } from '@sveltejs/kit';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { generatePipelineDeps, runGeneratePipeline } from '$lib/core/generate-pipeline';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import { createSafetyPolicySeam } from '$lib/seams/safety-policy-seam/policy';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const parsed = await parseRequestBody(event.request);
	if (!parsed.ok) return parsed.response;
	const imageGenerationSeam = createImageGenerationSeam(createImageProviderConfigSeam());
	const safetyPolicySeam = createSafetyPolicySeam();
	const pipelineResult = await runGeneratePipeline(parsed.body, {
		...generatePipelineDeps,
		checkContentSafety: safetyPolicySeam.validateGenerateRequest,
		// The single charge for this request. Built from this route's own event so it lands on
		// the real caller; the image pipeline below is handed the resulting `precharged` quota
		// rather than a gate, so one user request can never be billed twice.
		consumeQuota: createQuotaGate(event, 'image'),
		generateImage: (body, quota, signal) =>
			runImageGenerationPipeline(body, {
				imageGenerationSeam,
				quota,
				signal: signal ?? event.request.signal
			}),
		signal: event.request.signal
	});
	return json(pipelineResult.body, {
		status: pipelineResult.status,
		// Guard headers, verbatim, on denials and on post-charge responses alike.
		headers: pipelineResult.headers
	});
};
