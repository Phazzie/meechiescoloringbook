/*
Purpose: Orchestrate prompt assembly, image generation, and drift checks for the main UI.
Why: Keep generation flow server-driven behind a single endpoint.
Info flow: UI generate request -> validation -> prompt/image/drift seams -> JSON response.
*/
import { json } from '@sveltejs/kit';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import {
	checkGenerateAbort,
	checkGenerateInputShape,
	checkGeneratePromptGuards,
	checkGenerateSafety,
	generatePipelineDeps,
	runGeneratePipeline
} from '$lib/core/generate-pipeline';
import {
	checkImageGenerationProviderConfig,
	runImageGenerationPipeline
} from '$lib/core/image-generation-pipeline';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createSafetyPolicySeam } from '$lib/seams/safety-policy-seam/policy';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const abortCheck = checkGenerateAbort(request.signal);
	if (!abortCheck.ok) return json(abortCheck.response.body, { status: abortCheck.response.status });
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const shapeCheck = checkGenerateInputShape(parsed.body);
	if (!shapeCheck.ok) return json(shapeCheck.response.body, { status: shapeCheck.response.status });
	const safetyPolicySeam = createSafetyPolicySeam();
	const safetyCheck = checkGenerateSafety(shapeCheck.data, safetyPolicySeam.validateGenerateRequest);
	if (!safetyCheck.ok)
		return json(safetyCheck.response.body, { status: safetyCheck.response.status });
	const promptGuardCheck = await checkGeneratePromptGuards(shapeCheck.data, generatePipelineDeps);
	if (!promptGuardCheck.ok)
		return json(promptGuardCheck.response.body, { status: promptGuardCheck.response.status });
	// Preflight above awaits spec validation/prompt assembly, so a client can disconnect
	// during that window; re-check here to avoid burning a rate-limit slot for no paid work.
	const lateAbortCheck = checkGenerateAbort(request.signal);
	if (!lateAbortCheck.ok)
		return json(lateAbortCheck.response.body, { status: lateAbortCheck.response.status });
	const imageProviderConfigSeam = createImageProviderConfigSeam();
	const configCheck = checkImageGenerationProviderConfig(imageProviderConfigSeam);
	if (!configCheck.ok)
		return json(configCheck.response.body, { status: configCheck.response.status });
	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;
	const imageGenerationSeam = createImageGenerationSeam(imageProviderConfigSeam);
	const pipelineResult = await runGeneratePipeline(parsed.body, {
		...generatePipelineDeps,
		checkContentSafety: safetyPolicySeam.validateGenerateRequest,
		generateImage: (body, signal) =>
			runImageGenerationPipeline(body, {
				imageGenerationSeam,
				signal: signal ?? request.signal
			}),
		signal: request.signal,
		precomputedPrompt: promptGuardCheck.prompt
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
