/*
Purpose: Server endpoint for MeechieStudioTextSeam.
Why: Keep AI text generation server-side and schema-validated.
Info flow: Client request -> rate limit gate -> studio text pipeline -> JSON response.
*/
import { env } from '$env/dynamic/private';
import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';
import { json } from '@sveltejs/kit';
import {
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import { safeClientAddress } from '$lib/server/client-address';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { rateLimitedResponse } from '$lib/server/rate-limit-response';
import type { RequestHandler } from './$types';

const rateLimitSeam = createRateLimitSeam({ limit: 10, windowMs: 60_000 });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rateLimitResult = rateLimitSeam.checkAndConsume(safeClientAddress(getClientAddress), Date.now());
	if (!rateLimitResult.ok) return rateLimitedResponse(rateLimitResult.error);

	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const deps: MeechieStudioTextPipelineDeps = {
		createProvider: createProviderAdapter,
		textModel: env.XAI_TEXT_MODEL,
		isProduction: env.NODE_ENV === 'production'
	};
	const pipelineResult = await runMeechieStudioTextPipeline(parsed.body, deps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
