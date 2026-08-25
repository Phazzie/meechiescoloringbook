/*
Purpose: Server endpoint for MeechieStudioTextSeam.
Why: Keep AI text generation server-side and schema-validated.
Info flow: Client request -> studio text pipeline -> JSON response.
*/
import { env } from '$env/dynamic/private';
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import { json } from '@sveltejs/kit';
import {
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	// Reuses the shared providerAdapter singleton so its circuit breaker accumulates failures
	// across requests instead of resetting on every invocation.
	const deps: MeechieStudioTextPipelineDeps = {
		createProvider: () => providerAdapter,
		textModel: env.XAI_TEXT_MODEL,
		isProduction: env.NODE_ENV === 'production'
	};
	const pipelineResult = await runMeechieStudioTextPipeline(parsed.body, deps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
