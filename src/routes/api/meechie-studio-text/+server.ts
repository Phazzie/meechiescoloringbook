/*
Purpose: Server endpoint for MeechieStudioTextSeam.
Why: Keep AI text generation server-side and schema-validated.
Info flow: Client request -> studio text pipeline -> JSON response.
*/
import { env } from '$env/dynamic/private';
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import { json } from '@sveltejs/kit';
import {
	checkMeechieStudioTextAbort,
	checkMeechieStudioTextInputShape,
	checkMeechieStudioTextProviderConfig,
	checkMeechieStudioTextSafety,
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const abortCheck = checkMeechieStudioTextAbort(request.signal);
	if (!abortCheck.ok) return json(abortCheck.response.body, { status: abortCheck.response.status });
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const shapeCheck = checkMeechieStudioTextInputShape(parsed.body);
	if (!shapeCheck.ok) return json(shapeCheck.response.body, { status: shapeCheck.response.status });
	const safetyCheck = checkMeechieStudioTextSafety(shapeCheck.data);
	if (!safetyCheck.ok)
		return json(safetyCheck.response.body, { status: safetyCheck.response.status });
	// parseRequestBody above is awaited, so a client can disconnect during that
	// window; re-check here to avoid burning a rate-limit slot for no paid work.
	const lateAbortCheck = checkMeechieStudioTextAbort(request.signal);
	if (!lateAbortCheck.ok)
		return json(lateAbortCheck.response.body, { status: lateAbortCheck.response.status });
	const configCheck = checkMeechieStudioTextProviderConfig(env.XAI_API_KEY);
	if (!configCheck.ok)
		return json(configCheck.response.body, { status: configCheck.response.status });
	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;
	// Reuses the shared providerAdapter singleton so its circuit breaker accumulates failures
	// across requests instead of resetting on every invocation.
	const deps: MeechieStudioTextPipelineDeps = {
		createProvider: () => providerAdapter,
		textModel: env.XAI_TEXT_MODEL,
		isProduction: env.NODE_ENV === 'production',
		signal: request.signal
	};
	const pipelineResult = await runMeechieStudioTextPipeline(parsed.body, deps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
