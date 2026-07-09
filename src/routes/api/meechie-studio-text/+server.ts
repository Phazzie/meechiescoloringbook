/*
Purpose: Server endpoint for MeechieStudioTextSeam.
Why: Keep AI text generation server-side and schema-validated.
Info flow: Client request -> studio text pipeline -> JSON response.
*/
import { env } from '$env/dynamic/private';
import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import { rateLimitSeam } from '$lib/adapters/rate-limit-seam';
import { json } from '@sveltejs/kit';
import {
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import { MEECHIE_STUDIO_TEXT_RATE_LIMIT } from '$lib/server/rate-limit-config';
import { enforceRateLimit, resolveClientAddress } from '$lib/server/rate-limit-guard';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const limited = enforceRateLimit(
		rateLimitSeam,
		resolveClientAddress(getClientAddress),
		'meechie-studio-text',
		MEECHIE_STUDIO_TEXT_RATE_LIMIT
	);
	if (limited) return limited;

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
